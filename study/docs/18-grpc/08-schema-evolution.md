---
parent: 18-grpc
seq: 08
title: Schema evolution — field number · reserved · oneof · Buf
type: deep
created: 2026-05-01
---

# 08. Schema evolution

> 스키마는 한 번 배포되면 영원히 함께 산다. proto 의 진화 규칙을 모르면 서비스를 깨뜨린다.

## 1. 호환성의 두 방향

| 용어 | 의미 | 누가 |
|---|---|---|
| **Backward compat** | 새 schema 의 코드가 옛 데이터를 읽을 수 있음 | reader 가 새, writer 가 옛 |
| **Forward compat** | 옛 schema 의 코드가 새 데이터를 읽을 수 있음 | reader 가 옛, writer 가 새 |
| **Full compat** | 둘 다 만족 | 양방향 |

MSA 에서 서비스 배포 순서가 보장 안 될 때 (rolling update, 분리된 팀) **full compat** 가 default.

## 2. wire format 이 만든 호환 규칙

[#07 wire format](07-protobuf-wire-format.md) 에서:
- 필드 식별자는 **number** (이름 X)
- 모르는 tag 는 wire type 으로 skip + (proto3 3.5+) 보존
- default 값은 wire 생략

⇒ 이로부터 자연스럽게 따라오는 호환 규칙:

| 변경 | wire 호환 | 의미 호환 |
|---|---|---|
| 필드 추가 (새 number) | ✅ | ✅ (옛 reader 는 무시 + 보존) |
| 필드 삭제 | ✅ | △ (해당 필드 없는 메시지로 디코드, default 값) |
| 필드 number 변경 | ❌ | ❌ (wire 가 다른 필드로 인식) |
| **필드 number 재사용** | ❌ ❌ ❌ | 절대 금지 (silent corruption) |
| 필드 type 변경 (호환 그룹 내) | △ (그룹별로) | △ |
| singular ↔ repeated 변경 | △ | △ |

## 3. 절대 금지: field number 재사용

```protobuf
// v1
message Product {
  int64 id = 1;
  string name = 2;     // 삭제 예정
}

// v2 (잘못된 변경)
message Product {
  int64 id = 1;
  int32 stock = 2;     // ⚠️ name 의 number 2 를 재사용
}
```

문제:
- 옛 클라가 `name = "iPhone"` 을 송신 → wire = `tag(2,LEN) "iPhone"`
- 새 서버가 `stock = ?` 으로 디코드 → LEN 을 int32 로 해석 = **silent corruption** 또는 PROTOCOL_ERROR
- 로그에 안 나타나는 가장 위험한 버그

**해결: `reserved` 키워드**

```protobuf
message Product {
  int64 id = 1;
  reserved 2;                 // number 재사용 차단
  reserved "name";            // 이름 재사용 차단 (선택)
  int32 stock = 3;            // 새 필드는 다른 number
}
```

protoc 가 `reserved 2` 를 사용하려는 시도를 컴파일 타임 에러로 막아준다.

## 4. 필드 추가의 안전성

```protobuf
// v1
message Order {
  int64 id = 1;
  int64 customer_id = 2;
}

// v2 — 안전
message Order {
  int64 id = 1;
  int64 customer_id = 2;
  string memo = 3;            // 새 필드 추가
  repeated string tags = 4;
}
```

- 옛 reader: tag 3, 4 를 모르므로 skip + 보존 (proto3 3.5+)
- 새 writer 가 보낸 메시지를 옛 reader 가 디코드 → memo / tags 무시, 나머지 정상
- ⇒ **forward compat**

⚠️ 단 **required 가 있던 proto2** 에서는 새 필드를 required 로 추가하면 옛 클라이언트의 메시지 reject. proto3 에는 required 가 없어 이 함정 없음.

## 5. 필드 삭제 / deprecated

### 즉시 삭제 (위험)

```protobuf
message Product {
  int64 id = 1;
  // string name = 2;   삭제됨
}
```

- 옛 클라가 `name` 을 보내도 새 reader 는 unknown 으로 보존만 함 (의미 손실)
- 다른 새 필드가 number 2 를 안 쓰면 wire 호환은 OK

### 권장: `deprecated` → `reserved`

```protobuf
// step 1: deprecated 표시 (한 릴리스 동안 클라이언트 마이그레이션)
message Product {
  int64 id = 1;
  string name = 2 [deprecated = true];
}

// step 2: 실제 삭제 + reserved
message Product {
  int64 id = 1;
  reserved 2;
  reserved "name";
}
```

→ Buf breaking detection 도 이 패턴을 강제 가능.

## 6. type 변경 호환 그룹

같은 wire type 그룹 내 변경은 일부 호환:

| 호환 그룹 | 호환 변경 |
|---|---|
| VARINT | int32 ↔ int64 ↔ uint32 ↔ uint64 ↔ bool ↔ enum (큰→작은은 truncation) |
| sint group | sint32 ↔ sint64 (단, int* 와는 호환 X) |
| fixed | fixed32 ↔ sfixed32, fixed64 ↔ sfixed64 |
| LEN | string ↔ bytes (UTF-8 검증만 차이) |
| LEN | message ↔ bytes (위험, 권장 X) |

**불호환** 변경:
- int32 ↔ sint32 (varint 인코딩 다름)
- int32 ↔ fixed32 (wire type 다름)
- string → message (의미 변경)

## 7. singular ↔ repeated 변환

```protobuf
// v1
string tag = 1;

// v2
repeated string tag = 1;
```

- proto3 의 packed repeated string 은 불가 (string 은 LEN, packed 가능 wire 만 packed)
- string repeated 의 wire 는 `tag(1, LEN) "a" tag(1, LEN) "b"` — 단일 string 의 인코딩과 호환
- 옛 reader (singular) 는 마지막 값만 보유, 새 reader (repeated) 는 모두 보유
- ⇒ **wire 호환 OK**, 의미는 약간 달라짐 (acceptable)

scalar repeated (int) 는 packed default 라 약간 더 복잡 — wire 가 단일 LEN 으로 인코딩되므로 옛 singular reader 가 디코드 실패 가능. 신중히.

## 8. oneof — 분기 타입의 안전한 진화

```protobuf
message Notification {
  oneof channel {
    EmailChannel email = 2;
    SmsChannel sms = 3;
  }
}
```

진화 규칙:
- 새 case 추가 = **안전** (옛 reader 는 unknown 으로 무시)
- case 삭제 = number 만 reserved 로 보호
- oneof 안의 필드를 oneof 밖으로 이동 = ⚠️ 의미 변경
- singular 필드를 oneof 로 이동 = ⚠️ binary 호환은 OK 지만 has_* 의미 변경

oneof 의 강점:
- 한 번에 하나만 set → schema 가 의도를 명확히 표현
- 새 case 추가가 안전 → 확장성 우수

## 9. enum 진화

```protobuf
enum OrderStatus {
  ORDER_STATUS_UNSPECIFIED = 0;
  ORDER_STATUS_PLACED = 1;
  ORDER_STATUS_PAID = 2;
}
```

규칙:
- 새 값 추가 = **안전** (옛 reader 는 모르는 enum 값을 *unknown number* 로 보존)
- 값 삭제 = `reserved` 권장
- 0 의미 변경 = 위험 (default 와 결합)

⚠️ **closed enum semantics** (proto2) vs **open** (proto3):
- proto2: 모르는 값은 unknown field 로 분리 → 디코드 후 enum 변수에 안 들어감
- proto3: 모르는 값을 그냥 정수로 저장 → 코드에서 switch 분기 못 탐
- 새 값 추가는 proto3 에서 더 자연스러움

## 10. 잘 알려진 패턴

### 10-1. 버전 패키지

```protobuf
package commerce.product.v1;
package commerce.product.v2;
```

- major 변경 (의미 깨짐) 시 v1 → v2 로 분리, 한동안 병렬 운영
- 클라이언트는 자기 속도로 마이그레이션
- proto 패키지 = Java 패키지 = 별도 클래스 → 의존성 충돌 없음

### 10-2. Wrapper / FieldMask 로 partial update

```protobuf
message UpdateProductRequest {
  int64 id = 1;
  optional string name = 2;
  optional int32 stock = 3;
  google.protobuf.FieldMask update_mask = 99;
}
```

- 새 필드 추가 = optional + mask 후보로 끝
- API 안정성 ↑

### 10-3. message wrapper 로 단일 필드 → 다중 필드 진화

```protobuf
// v1
rpc GetProduct(GetProductRequest) returns (Product);

// v2 — Product 직접 반환에서 wrapper 로
rpc GetProduct(GetProductRequest) returns (GetProductResponse);
message GetProductResponse {
  Product product = 1;
  // 나중에 추가 가능: pricing, reviews, ...
}
```

→ **응답을 항상 wrapper message 로 감싸는 컨벤션** 권장 (Google API 가이드).

## 11. Buf — schema 거버넌스 도구

### Buf 가 해주는 것

1. **lint** — Google API 가이드 + 자체 룰 (필드 number 1-15 권장, enum prefix 등)
2. **breaking detection** — git diff / 커밋 비교로 호환성 위반 탐지
3. **format** — proto 파일 표준화 정렬
4. **codegen** — protoc 플러그인 보다 단순한 yaml 설정
5. **BSR (Buf Schema Registry)** — proto 패키지를 npm 처럼 게시 / 의존성 관리

### 기본 사용

```bash
buf lint
buf format -w
buf breaking --against '.git#branch=main'
buf generate
```

`buf.yaml`:
```yaml
version: v2
modules:
  - path: proto
lint:
  use:
    - STANDARD
breaking:
  use:
    - FILE
```

`buf.gen.yaml`:
```yaml
version: v2
plugins:
  - remote: buf.build/protocolbuffers/java
    out: gen/java
  - remote: buf.build/grpc/kotlin
    out: gen/kotlin
```

### CI 통합

```yaml
# .github/workflows/proto.yml
- name: Buf lint
  run: buf lint
- name: Buf breaking
  run: buf breaking --against 'https://github.com/${{ github.repository }}.git#branch=main'
```

→ PR 단계에서 schema 파괴를 막음. msa 에 도입 시 **lint + breaking detection 만 도입해도 가치 큼** (BSR 은 선택).

## 12. msa 도입 시 권장 정책 초안

1. 모든 proto 는 `commerce.<service>.v1` 같은 **버전 패키지** 강제
2. **`reserved` 가 없는 PR 거부** — Buf 룰
3. **응답 wrapper 메시지** 강제 (`GetXxxResponse` 형태)
4. 신규 필드는 **optional** 또는 **wrapper / oneof** 로 has_* 가능하게
5. **Buf breaking** 을 PR 검증에 추가
6. major 변경 = `v2` 패키지 신규 생성 + **deprecated v1 6개월 유지 후 제거**

## 13. 진화 사례 (가상 — msa product)

```protobuf
// v1.0
message Product {
  int64 id = 1;
  string name = 2;
  int64 price_cents = 3;
}

// v1.1 — 필드 추가 (안전)
message Product {
  int64 id = 1;
  string name = 2;
  int64 price_cents = 3;
  optional int32 stock = 4;            // 추가
  repeated string tags = 5;            // 추가
}

// v1.2 — name 을 다국어로 → 위험한 변경
message Product {
  int64 id = 1;
  reserved 2;
  reserved "name";
  int64 price_cents = 3;
  optional int32 stock = 4;
  repeated string tags = 5;
  map<string, string> name_i18n = 6;   // 새 필드
}
```

⚠️ name 제거는 모든 클라이언트가 `name_i18n` 을 사용하도록 마이그레이션된 후에만 안전.

## 14. 면접 핵심

> Q: gRPC schema 를 안전하게 진화시키는 법?

A:
1. field number 절대 재사용 금지, 삭제 시 `reserved`
2. 새 필드는 optional 로 추가 (forward compat)
3. type 변경은 호환 그룹 내에서만
4. enum 0 = `_UNSPECIFIED` 컨벤션
5. major 변경은 패키지 버전 (`v2`) 분리
6. Buf breaking detection 을 CI 에 추가

> Q: 옛 클라이언트가 보낸 모르는 필드는?

A: proto3 3.5+ 부터 unknown field 로 보존 → 송신 시 다시 wire 에 포함. 중간 서비스가 옛 schema 라도 새 필드를 잃지 않아 pass-through 안전.

## 다음 학습

- [09-advanced-features.md](09-advanced-features.md) — Deadline / Interceptor / Metadata
- [17-proto-monorepo-strategy.md](17-proto-monorepo-strategy.md) — Buf + monorepo 운영
