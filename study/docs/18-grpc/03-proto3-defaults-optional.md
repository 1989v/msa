---
parent: 18-grpc
seq: 03
title: proto3 default value & optional 의 변천
type: deep
created: 2026-05-01
---

# 03. proto3 default & optional

## 1. 왜 이 주제가 중요한가

proto2 → proto3 → proto3.15 의 변화는 **"필드가 없다 vs 0 이다"** 를 어떻게 구별할지의 역사다. 이걸 모르면:

- API 가 "0 으로 업데이트해줘" 와 "이 필드는 안 건드림" 을 구분 못 함
- partial update 구현 불가 → REST 의 PATCH 의미를 못 표현
- 대기업 면접 단골 질문 ("proto3 에서 optional 은 왜 부활했나?")

## 2. proto2 의 모델 (역사)

proto2 는 모든 필드에 명시적 quantifier 가 있었다.

```protobuf
// proto2
message Product {
  required int64 id = 1;       // 필수 (없으면 직렬화/파싱 실패)
  optional string name = 2;    // 선택 (set/unset 구분 가능)
  repeated string tags = 3;
  optional int32 stock = 4 [default = 0];   // 명시 default
}
```

- `optional` → `hasName()` 메서드로 set/unset 검사 가능
- `required` → schema evolution 에 위험 (필드 제거 불가) → 사실상 폐기됨
- `default` → 명시 가능

## 3. proto3 의 단순화 (그리고 그게 만든 문제)

proto3 (2014, gRPC 와 함께 보급) 는 `required` / `optional` / `default` 를 모두 제거하고 단순화:

```protobuf
// proto3 (초기 버전)
message Product {
  int64 id = 1;
  string name = 2;
  int32 stock = 3;
  bool active = 4;
}
```

**규칙**:
- 모든 scalar 는 *implicit default* (int=0, string="", bool=false, bytes=empty)
- "필드가 set 안 됨" 은 **default 값과 구별 불가**
- `hasField()` 메서드 없음 (scalar 에 한해)
- wire 에 default 값은 **인코딩 생략** (송신 시 0 인 필드는 byte 안 씀)

### 이게 만든 문제: "0 vs 미설정" 구별 불가

```kotlin
// 시나리오: PATCH 의미로 stock 만 업데이트
val req = UpdateProductRequest.newBuilder()
    .setId(123)
    .setStock(0)        // 의도: stock 을 0 으로 변경
    .build()

// 서버 측에서 받았을 때:
//   req.stock == 0  ← 이게 "0 으로 업데이트해줘" 인지 "stock 안 건드림" 인지 모름
```

특히 **JSON ↔ proto3 매핑** 시 명확:
- JSON `{"stock": 0}` → proto3 `stock=0`
- JSON `{}` (stock 누락) → proto3 `stock=0`
- 둘이 wire 에서 동일하게 직렬화됨 ⇒ partial update 의미 손실

### proto3 초기 우회법 3가지

1. **Wrapper types** (`google.protobuf.Int32Value`)
   ```protobuf
   import "google/protobuf/wrappers.proto";
   message UpdateProductRequest {
     int64 id = 1;
     google.protobuf.Int32Value stock = 2;   // null 가능
     google.protobuf.StringValue name = 3;
   }
   ```
   - 내부적으로 `message Int32Value { int32 value = 1; }` — 메시지 타입은 has_*가 가능
   - 단점: boxing 비용, Java 에서 `setStock(Int32Value.of(0))` 처럼 verbose

2. **FieldMask** (Google API style)
   ```protobuf
   message UpdateProductRequest {
     Product product = 1;
     google.protobuf.FieldMask update_mask = 2;  // ["stock", "name"]
   }
   ```
   - 명시적 "이 필드들만 업데이트" 표현 — REST 의 PATCH 와 일치

3. **Sentinel value** — `-1` 등을 "미설정" 으로 약속 (취약, 권장 X)

## 4. proto3.15 (2021) — `optional` 의 부활

커뮤니티의 강한 요구로 proto3.15 부터 **`optional` 키워드가 다시 도입**됐다.

```protobuf
syntax = "proto3";

message Product {
  int64 id = 1;
  optional string name = 2;       // ← 부활
  optional int32 stock = 3;
}
```

생성된 Kotlin/Java 코드:

```kotlin
val product = Product.newBuilder()
    .setId(123)
    .setStock(0)              // 명시적으로 set
    .build()

product.hasName()    // false  (set 안 했음)
product.hasStock()   // true   (0 이라도 set)
```

**동작 원리**: `optional` 은 내부적으로 *single-field oneof* 로 컴파일된다.

```protobuf
optional int32 stock = 3;
// ↓ 내부 표현 (gen code 기준)
oneof _stock {
  int32 stock = 3;
}
```

⇒ wire 에 "set 됐다" 는 정보가 인코딩됨 (oneof 의 case 가 0 이 아닌 값으로) → has_* 가능.

### proto3.15 이후의 컨벤션

- **partial update / patch 의미 필요한 필드** = `optional` 권장
- **항상 set 되는 필수 필드** (id 등) = `optional` 불필요
- **wrapper types 보다 `optional` 우선** (boxing 비용 ↓, 코드 자연스러움)

## 5. 호환성 / 진화 측면

| 변경 | wire 호환 | 의미 호환 | 비고 |
|---|---|---|---|
| `int32 x = 1` → `optional int32 x = 1` | ✅ | △ (구버전은 has_* 없음) | 안전 |
| `optional int32 x = 1` → `int32 x = 1` | ✅ | ❌ (has_x 사라짐) | API 깨짐 |
| `optional` ↔ `singular` 변환 | wire 호환 | 의미 변경 |
| `optional T` → `oneof` 추가 | ✅ (이미 oneof 임) | ✅ | 유연한 진화 |

**실무 권고**: 신규 proto 는 처음부터 `optional` 로 시작 (성능 차이 무시할 수 있음 + 의미 명확).

## 6. JSON 매핑과의 관계

proto ↔ JSON 매핑 (`google.protobuf.util.JsonFormat`):

| proto | JSON 송신 (default 값) | JSON 수신 |
|---|---|---|
| `int32 x = 1` (no optional) | 0 이면 **생략** (관례) 또는 `"x": 0` (옵션 활성화 시) | `0` 이든 누락이든 동일 |
| `optional int32 x = 1` | set 됐으면 항상 송신 (0 도 `"x": 0` 으로) | `0` ≠ 누락 (구분 가능) |
| `repeated` | 빈 배열 `[]` 생략 (관례) | `[]` 와 누락 동일 |
| enum | 0 값은 생략 가능 | 문자열 또는 숫자 둘 다 수용 |

`JsonFormat.Printer`/`Parser` 옵션:
- `includingDefaultValueFields()` — default 값도 명시적으로 송신
- `preservingProtoFieldNames()` — `snake_case` 유지 (기본은 `camelCase`)
- `ignoringUnknownFields()` — 수신 시 모르는 필드 무시 (호환성)

## 7. enum 의 default 와 unspecified 컨벤션

proto3 enum 은 **0 값이 default** 이며 정의 필수.

```protobuf
enum OrderStatus {
  ORDER_STATUS_UNSPECIFIED = 0;   // ← 명시적 unspecified 컨벤션
  ORDER_STATUS_PLACED = 1;
  ORDER_STATUS_PAID = 2;
}
```

이유:
- 필드를 안 보낸 메시지는 enum=0 으로 디코드됨 → 의미 있는 값에 0 을 두면 "안 보냄" 과 구별 불가
- Google API style guide: 항상 `_UNSPECIFIED = 0` 추가

서버는 `_UNSPECIFIED` 를 받으면 INVALID_ARGUMENT 로 거부하거나 default 처리 정책을 명확히 해야 한다.

## 8. 현실의 면접 질문

> Q: proto3 에서 optional 이 빠졌다가 다시 들어온 이유는?

A:
1. proto3 단순화로 has_* 가 사라지자 partial update / null semantic 표현 불가
2. 우회법 (Wrapper types, FieldMask) 은 verbose
3. proto3.15 에서 single-field oneof 로 구현 → wire 호환 + has_* 복원

> Q: proto3 의 `int32 x = 1` 과 `optional int32 x = 1` 의 wire 차이는?

A:
- 전자: x=0 일 때 wire 에 안 보냄
- 후자: x=0 이라도 oneof 처럼 인코딩 → 수신측에서 has_x()=true

> Q: 화폐 (price) 를 proto 에 어떻게 표현?

A:
- `double` ❌ (정밀도 손실)
- `int64 price_cents = 1` (가장 단순)
- `string price = 1` (BigDecimal 호환, 파싱 비용)
- `google.type.Money { string currency_code = 1; int64 units = 2; int32 nanos = 3 }` (Google API)

## 9. msa 적용 시 고려

msa 의 `Product` / `Order` / `Member` 는 partial update 가 흔함:
- 가격 변경, 재고 변경, 이름 변경 — 각각 별도 요청
- 현재 REST 는 PATCH + nullable DTO 로 처리
- gRPC 도입 시 → 모든 mutable 필드는 `optional` + `FieldMask` 조합 권장

```protobuf
service ProductService {
  rpc UpdateProduct(UpdateProductRequest) returns (Product);
}

message UpdateProductRequest {
  int64 id = 1;
  optional string name = 2;
  optional int32 stock = 3;
  optional int64 price_cents = 4;
  google.protobuf.FieldMask update_mask = 99;
}
```

## 다음 학습

- [04-grpc-call-patterns.md](04-grpc-call-patterns.md) — 4가지 호출 패턴
- [08-schema-evolution.md](08-schema-evolution.md) — optional 추가/제거의 호환성
