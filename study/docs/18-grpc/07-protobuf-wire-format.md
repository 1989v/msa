---
parent: 18-grpc
seq: 07
title: Protobuf wire format — varint · tag-wire-type · packed · JSON 비교
type: deep
created: 2026-05-01
---

# 07. Protobuf wire format

> "왜 빠른가" 를 정확히 답하려면 wire format 을 알아야 한다. 이게 면접/실무에서 의외로 자주 깊이 들어간다.

## 1. Wire format 의 기본 규칙

Protobuf 의 메시지는 **연속된 (tag, value) pair 의 배열** 이다.

```
[ tag1 | value1 ][ tag2 | value2 ][ tag3 | value3 ] ...
```

- 메시지 자체에 길이 / 필드 개수 / 종료 마커 없음
- 길이는 **외부 컨테이너** (HTTP/2 DATA frame, 또는 length-prefix)가 알려줌
- 필드 순서는 임의 (보통 number 순이지만 강제 X)
- **모르는 tag** 는 wire type 정보로 skip 가능 (forward compat)

## 2. tag = (field_number << 3) | wire_type

각 필드의 tag 는 **field number 와 wire type 을 합친 varint**.

```
tag = (field_number << 3) | wire_type   ← varint 인코딩
```

### Wire type 6 가지 (proto3 에서 4 개 활용)

| wire_type | 값 | 의미 | 사용 |
|---|---|---|---|
| VARINT | 0 | 가변 길이 정수 | int32, int64, uint32, bool, enum |
| I64 | 1 | 8 byte 고정 | fixed64, sfixed64, double |
| LEN | 2 | length-delimited | string, bytes, embedded message, packed repeated |
| SGROUP | 3 | (deprecated) | proto2 group 시작 |
| EGROUP | 4 | (deprecated) | proto2 group 끝 |
| I32 | 5 | 4 byte 고정 | fixed32, sfixed32, float |

→ 대부분 **VARINT (0), LEN (2), I64 (1), I32 (5)** 만 만남.

### 예시

```protobuf
message Person {
  int32 age = 1;     // field 1, wire type VARINT(0)
  string name = 2;   // field 2, wire type LEN(2)
}
```

```
field 1 → tag = (1 << 3) | 0 = 0x08
field 2 → tag = (2 << 3) | 2 = 0x12
```

## 3. Varint 인코딩 (LEB128 변형)

> 작은 수는 작은 바이트 수로, 큰 수는 큰 바이트로.

규칙:
- 매 byte 의 **MSB (continuation bit)** = "다음 byte 계속 있음"
- 나머지 7 bit 가 실제 데이터 (little-endian)

### 예: 1 인코딩

```
1 = 0b0000001 → 1 byte
0x01
```

### 예: 300 인코딩

```
300 = 0b 0000010 0101100
   ↓ 7-bit groups (little endian)
group 0 (low):  0101100  → continuation=1 → 0xAC
group 1 (high): 0000010  → continuation=0 → 0x02

wire: 0xAC 0x02
```

### 음수의 함정 (int32 vs sint32)

```
int32 x = -1;
// 64-bit 부호확장 → 0xFFFFFFFFFFFFFFFF → varint 10 byte (!)
```

`int32` 는 음수일 때 64-bit 부호확장 후 varint 인코딩 → **음수는 항상 10 byte**.

해결: `sint32` / `sint64` 의 ZigZag 인코딩.

### ZigZag

```
0 → 0
-1 → 1
1 → 2
-2 → 3
2 → 4
...
n → (n << 1) ^ (n >> 31)   // sint32
```

음수 ↔ 양수 매핑으로 작은 절대값이 작은 byte 가 되도록.

```
-1 sint32 → 1 → 1 byte
-100 sint32 → 199 → 2 byte
```

→ **음수 자주면 sint*, 양수만이면 int* / uint***

## 4. LEN (length-delimited) 인코딩

string / bytes / nested message / packed repeated 가 사용.

```
[ tag (VARINT) ][ length (VARINT) ][ payload ... ]
```

예: `string name = 2; → "hi"`

```
tag = (2 << 3) | 2 = 0x12
length = 2
payload = 0x68 ('h'), 0x69 ('i')

wire: 0x12 0x02 0x68 0x69
```

### Nested message

```protobuf
message Order {
  Customer customer = 1;
}
```

→ Customer 의 인코딩을 length-prefix 로 감싼 LEN payload.

## 5. Packed repeated (proto3 default)

```protobuf
repeated int32 ids = 1;   // proto3: default packed
```

**proto2 (또는 proto3 에서 명시 unpacked):**
```
[tag][value1][tag][value2][tag][value3]...
```
→ tag 를 매번 반복

**proto3 packed (default):**
```
[tag (LEN type)][total_length][value1][value2][value3]...
```
→ tag 1번, 모든 값 연속 — 훨씬 작음.

⇒ scalar repeated (int, fixed) 는 무조건 packed 가 유리. **string / bytes / message 는 packed 불가** (각자 LEN 이 필요하므로 의미 없음).

## 6. 기본값 생략 (proto3)

proto3 는 **default 값을 wire 에 안 보냄** (송신 측 최적화).

```kotlin
val p = product { id = 0; name = "" }
p.toByteArray()  // 빈 byte 배열 (모든 필드가 default)
```

수신 측에서 "필드 없음" 으로 디코드 → default 값으로 채움.

영향:
- 작은 wire 크기
- "0 vs 미설정" 구별 불가 (→ optional 필요, [03 참조](03-proto3-defaults-optional.md))

## 7. Unknown field 처리 (forward compat)

수신자가 모르는 tag 를 만나면:
- wire_type 보고 길이 계산해서 skip
- (proto3 3.5+ 부터) **unknown field 보존** — 송신 시 다시 wire 에 포함
- → 중간 서비스가 옛 schema 라도 새 필드를 잃지 않음 (gRPC pass-through 에 중요)

## 8. 메시지 인코딩 전체 예

```protobuf
message Product {
  int64 id = 1;
  string name = 2;
  int32 stock = 3;
}

// product { id = 1; name = "hi"; stock = 0 }
```

wire (hex):
```
08 01    ← tag=0x08(field 1, VARINT), value=1
12 02    ← tag=0x12(field 2, LEN), length=2
68 69    ← "hi"
         (field 3 stock=0 → default → 생략)

총 6 byte
```

JSON 비교:
```json
{"id":1,"name":"hi","stock":0}
```
= 30 byte (필드명 + 따옴표 + 콜론 + 콤마 포함)

→ **5x 차이**. 큰 메시지일수록 격차 ↑ (JSON 의 escape, UTF-8 검증 비용은 별도).

## 9. JSON vs Protobuf 벤치 (참고치)

> 메시지 모양에 따라 차이가 크지만 일반적 경향.

| 항목 | JSON | Protobuf | 비율 |
|---|---|---|---|
| 페이로드 크기 (단순 메시지) | 100% | 30% | 3x |
| 페이로드 크기 (필드명 긴 메시지) | 100% | 10% | 10x |
| 직렬화 속도 | 100% | 5-10% | 10-20x 빠름 |
| 역직렬화 속도 | 100% | 5-15% | 5-20x 빠름 |
| CPU 사용 (대량 처리) | 100% | 20-30% | 3-5x ↓ |

**왜 이렇게 빠른가**:
- 사전 컴파일된 직렬화 코드 (reflection 없음)
- UTF-8 escape / 따옴표 / whitespace 파싱 없음
- 타입 사전 결정 (런타임 dispatch 없음)
- varint = byte 단위 비트 연산
- string/bytes 는 length-prefix 라 단일 메모리 복사

**JSON 도 빨라질 수 있는가**:
- `kotlinx.serialization` + sealed schema → reflection 제거
- `simdjson` / `jsoniter` → 4x 가속 가능
- 그러나 **schema 합의가 없으면 결국 동적 검증 비용**이 든다 → 본질적 한계

## 10. gRPC 의 메시지 length-prefix

HTTP/2 DATA frame 안에 protobuf 메시지를 넣을 때 **gRPC 자체 framing** 을 추가:

```
[ compressed flag (1 byte) ][ message length (4 byte, big-endian) ][ message bytes ... ]
```

- compressed flag: 0 = uncompressed, 1 = compressed
- 한 DATA frame 에 여러 메시지 가능 (server-streaming 의 다중 응답)
- 한 메시지가 frame 경계를 넘어가도 OK (HTTP/2 frame 은 segmentation 가능)

## 11. 압축

- gRPC 메시지 단위 압축 = `grpc-encoding` metadata 헤더 (`gzip`, `identity`, `deflate`)
- HPACK 헤더 압축과 별개
- 압축 알고리즘 협상 = `grpc-accept-encoding`
- **작은 메시지 (<1KB) 는 압축 비효율** (CPU > 절감 byte)
- 큰 페이로드 (이미지, 큰 JSON-like 메시지) 에서만 의미

## 12. 언제 wire format 까지 알아야 하나

| 상황 | 필요한가 |
|---|---|
| 일반 RPC 작성 | ❌ |
| 면접 (gRPC 왜 빠른가) | ✅ varint, tag-wire-type 정도 |
| 메시지 크기 최적화 | ✅ packed, sint vs int |
| 직접 파서 작성 | ✅ 풀스펙 |
| 디버깅 (raw byte 분석) | ✅ tag 파싱 |
| schema 깨짐 분석 | ✅ unknown field 처리 |

## 13. 디코딩 도구

- `protoc --decode_raw` — schema 없이 raw byte 디코드 (tag 와 wire type 만 표시)
  ```bash
  cat product.bin | protoc --decode_raw
  ```
- `protoc --decode=Product product.proto < product.bin` — schema 기반 디코드
- `grpcurl` 의 `-proto` / `-emit-defaults` 옵션
- Wireshark Protobuf dissector

## 14. 면접 핵심 정리

> Q: Protobuf 가 JSON 보다 빠른 이유는?

A:
1. **사전 합의된 schema** → 필드명 / 타입 토큰 wire 미포함
2. **Varint** 가변 길이 → 작은 수가 1 byte
3. **tag = (field# << 3) | wire_type** → 1 byte tag 가 흔함
4. **Packed repeated** → 배열 tag 반복 제거
5. **컴파일된 직렬화 코드** → reflection 비용 0
6. **UTF-8 escape / whitespace 비용** 없음

> Q: int32 와 sint32 의 차이는?

A: int32 는 음수일 때 64-bit 부호확장 후 varint → 10 byte. sint32 는 ZigZag 매핑으로 음수도 작은 절대값이 짧은 byte. 음수 빈번 필드는 sint* 필수.

> Q: proto3 에서 0 인 필드는 wire 에 어떻게?

A: 송신 생략 (default = 0). 수신측은 필드 없음으로 디코드 후 default 값 0 으로 채움. 이 때문에 "0 으로 명시 set" vs "미설정" 구별 불가 → optional 키워드 (3.15+) 필요.

## 다음 학습

- [08-schema-evolution.md](08-schema-evolution.md) — wire format 호환성을 활용한 진화 규칙
- [11-error-handling.md](11-error-handling.md) — gRPC trailers / status 의 wire 표현
