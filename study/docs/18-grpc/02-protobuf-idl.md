---
parent: 18-grpc
seq: 02
title: Protobuf IDL — message, field number, scalar types
type: deep
created: 2026-05-01
---

# 02. Protobuf IDL

## 1. IDL 의 역할

Protocol Buffers 는 **언어 중립 IDL (Interface Definition Language)** 이다. `.proto` 파일은 다음을 동시에 정의:

- 메시지 (data shape)
- 서비스 / RPC (function signatures)
- 직렬화 규칙 (wire format 결정자)
- 진화 가능성 (field number, reserved)

`protoc` 컴파일러가 `.proto` 를 입력으로 Java/Kotlin/Go/Python 등 언어별 코드를 생성한다. **proto 파일이 single source of truth** — DTO/스키마/문서가 모두 여기서 파생.

## 2. proto3 기본 문법

```protobuf
syntax = "proto3";

package commerce.product.v1;     // 1. 패키지 (네임스페이스)

option java_package = "com.kgd.proto.commerce.product.v1";
option java_multiple_files = true;

import "google/protobuf/timestamp.proto";   // 2. 외부 타입 import

message Product {                 // 3. 메시지 정의
  int64 id = 1;                   // field number 1 (wire 에 인코딩됨)
  string name = 2;
  string description = 3;
  int64 price_cents = 4;          // 화폐는 int 가 안전 (부동소수 정밀도 X)
  ProductStatus status = 5;       // enum
  repeated string tags = 6;       // 배열
  google.protobuf.Timestamp created_at = 7;  // well-known type
}

enum ProductStatus {              // 4. enum (proto3 는 0 값 필수)
  PRODUCT_STATUS_UNSPECIFIED = 0;
  PRODUCT_STATUS_ACTIVE = 1;
  PRODUCT_STATUS_INACTIVE = 2;
  PRODUCT_STATUS_DELETED = 3;
}

service ProductService {          // 5. RPC 서비스
  rpc GetProduct(GetProductRequest) returns (GetProductResponse);
  rpc ListProducts(ListProductsRequest) returns (stream Product);   // server-streaming
}

message GetProductRequest {
  int64 id = 1;
}

message GetProductResponse {
  Product product = 1;
}

message ListProductsRequest {
  int32 page_size = 1;
  string page_token = 2;          // cursor pagination
}
```

### 명명 컨벤션 (Google 가이드 + Buf style)

- 메시지 / enum: `PascalCase` (`ProductStatus`)
- 필드: `snake_case` (`page_size`) — 코드 생성 시 언어별 컨벤션으로 변환 (Java `pageSize`, Kotlin `pageSize`)
- enum 값: `SCREAMING_SNAKE_CASE` + **prefix 권장** (`PRODUCT_STATUS_ACTIVE` — proto3 는 enum 이름이 같은 패키지 내에서 글로벌이므로 충돌 방지)
- 서비스: `XxxService` (`ProductService`), RPC: `PascalCase`
- 패키지: `com.example.foo.v1` 처럼 **버전 접미사** 강력 권장

## 3. Scalar 타입과 언어 매핑

| .proto 타입 | wire | Java/Kotlin | 비고 |
|---|---|---|---|
| `double` | fixed64 | `double` | 8 byte 고정 |
| `float` | fixed32 | `float` | 4 byte 고정 |
| `int32` | varint | `int` | 음수 비효율 (10 byte) |
| `int64` | varint | `long` | 음수 비효율 |
| `uint32` / `uint64` | varint | `int` / `long` | 양수만 |
| `sint32` / `sint64` | varint + ZigZag | `int` / `long` | **음수 자주면 이걸 써야** |
| `fixed32` / `fixed64` | fixed | `int` / `long` | 큰 양수에 유리 |
| `sfixed32` / `sfixed64` | fixed | `int` / `long` | 음수 가능 |
| `bool` | varint (1 byte) | `boolean` | |
| `string` | length-delimited | `String` | UTF-8 강제 (invalid 시 reject) |
| `bytes` | length-delimited | `ByteString` | 임의 바이너리 |

### int32 vs sint32 (자주 실수)

```protobuf
int32 delta = 1;   // 음수 -1 → 10 byte 인코딩 (varint 가 부호확장으로 길어짐)
sint32 delta = 1;  // 음수 -1 → 1 byte (ZigZag: 0,−1,1,−2,2 → 0,1,2,3,4 매핑)
```

→ **음수가 빈번한 필드 (delta, lat/lng offset)** 는 반드시 `sint*`. 자세한 인코딩은 [07-protobuf-wire-format.md](07-protobuf-wire-format.md) 참조.

## 4. Field number 의 의미

```protobuf
message Product {
  int64 id = 1;        // ← 이 "1" 은 wire 에 인코딩되는 식별자
  string name = 2;
}
```

- field number 는 **wire format 의 키** (필드명은 wire 에 안 보냄)
- 1-15: 1 byte tag, 16-2047: 2 byte tag → **자주 쓰는 필드는 1-15 에 배치**
- 19000-19999: protobuf 내부 예약 (사용 금지)
- 최대: 2^29 - 1 (536,870,911)
- **한 번 발행된 field number 는 영원히 변경/재사용 금지** (#08 참조)

## 5. 복합 타입

### 5.1 nested message

```protobuf
message Order {
  message LineItem {            // 내부 클래스처럼 노출
    int64 product_id = 1;
    int32 quantity = 2;
  }
  int64 id = 1;
  repeated LineItem items = 2;
}
```

### 5.2 enum (proto3)

```protobuf
enum OrderStatus {
  ORDER_STATUS_UNSPECIFIED = 0;   // proto3 는 0 값 필수 (default)
  ORDER_STATUS_PLACED = 1;
  ORDER_STATUS_PAID = 2;
  ORDER_STATUS_SHIPPED = 3;
}
```

- 0 = `_UNSPECIFIED` 컨벤션 (Google API style guide) — "값이 설정 안 됨" 을 명시적으로 표현
- enum 값은 같은 패키지 내 *글로벌 네임스페이스* → prefix 필수

### 5.3 repeated (배열)

```protobuf
repeated string tags = 1;        // List<String>
repeated int32 ids = 2 [packed = true];   // proto3 default = packed
```

- proto3 의 scalar repeated 는 **default packed** (연속 wire bytes, 더 작음)
- proto2 는 명시 필요 ([07 참조](07-protobuf-wire-format.md))

### 5.4 map

```protobuf
map<string, int32> stock_by_warehouse = 1;
```

- 내부적으로 `repeated MapEntry { key, value }` 로 인코딩
- 순서 보장 X, 중복 키는 마지막 값
- key 는 scalar 만 (float/double/bytes 제외)

### 5.5 oneof (분기 타입)

```protobuf
message Notification {
  string id = 1;
  oneof channel {
    EmailChannel email = 2;
    SmsChannel sms = 3;
    PushChannel push = 4;
  }
}
```

- 한 번에 하나만 set, 메모리 절약
- field number 는 `oneof` 내에서도 메시지 전체 내에서 유일해야 함
- **schema evolution 의 강력한 도구** — 신규 채널 추가 시 다른 필드와 충돌 없음

## 6. 서비스 정의 (RPC)

```protobuf
service ProductService {
  rpc GetProduct(GetProductRequest) returns (GetProductResponse);
  rpc ListProducts(ListProductsRequest) returns (stream Product);              // server-streaming
  rpc UploadImages(stream UploadImageRequest) returns (UploadImagesResponse);  // client-streaming
  rpc Chat(stream ChatMessage) returns (stream ChatMessage);                   // bidi
}
```

- request / response 는 항상 **메시지** (scalar 직접 불가) — 이유: schema evolution 가능성
- `stream` 키워드로 4 패턴 전환
- 한 서비스 내 RPC 이름은 unique

## 7. import / package / option

```protobuf
syntax = "proto3";
package commerce.product.v1;

option java_package = "com.kgd.proto.commerce.product.v1";
option java_multiple_files = true;       // 메시지마다 별도 .java 파일 (더 깔끔)
option java_outer_classname = "ProductProto";   // (multiple_files=false 일 때 wrapper 클래스 이름)
option go_package = "github.com/kgd/proto/commerce/product/v1;productv1";

import "google/protobuf/timestamp.proto";
import "google/protobuf/empty.proto";
import "common/error/v1/error_details.proto";
```

- `package` 는 .proto 내부 네임스페이스 (메시지 충돌 방지)
- `option java_package` 로 언어별 패키지 별도 지정
- import 는 proto 파일 경로 (build 도구가 root 경로 설정)

## 8. well-known types (구글 표준 타입)

| 타입 | import | 용도 |
|---|---|---|
| `google.protobuf.Timestamp` | `google/protobuf/timestamp.proto` | UTC 시각 (seconds + nanos) |
| `google.protobuf.Duration` | `google/protobuf/duration.proto` | 시간 간격 |
| `google.protobuf.Empty` | `google/protobuf/empty.proto` | 인자/응답 없음 (`rpc Ping(Empty) returns (Empty)`) |
| `google.protobuf.Any` | `google/protobuf/any.proto` | 타입 미정 메시지 (TypeURL + bytes) |
| `google.protobuf.FieldMask` | `google/protobuf/field_mask.proto` | partial update 필드 지정 |
| `google.protobuf.Struct` | `google/protobuf/struct.proto` | 동적 JSON-like 객체 |

→ **자체 timestamp 타입 만들지 말 것**. Google well-known 사용이 호환성/도구 지원에 우월.

## 9. msa 가 도입 시 디렉토리 예 (가상)

```
proto/
  commerce/
    product/v1/
      product.proto
      product_service.proto
    order/v1/
      order.proto
      order_service.proto
    inventory/v1/
      inventory_service.proto
  common/
    error/v1/
      error_details.proto
    pagination/v1/
      page.proto
buf.yaml
buf.gen.yaml
```

(전략은 [17-proto-monorepo-strategy.md](17-proto-monorepo-strategy.md) 에서 확장.)

## 10. 자주 하는 실수

| 실수 | 결과 |
|---|---|
| field number 1-15 를 잘 안 쓰는 필드에 낭비 | wire 크기 증가 |
| enum 0 을 의미 있는 값에 할당 | "값 미설정" 과 구분 불가 |
| `int32` 로 음수 표현 | 10 byte 인코딩 (sint32 사용 시 1 byte) |
| 자체 timestamp 메시지 만들기 | 도구 호환성 ↓, JSON 매핑 비표준 |
| 패키지에 `v1` 안 붙이기 | major 변경 시 전체 마이그레이션 어려움 |
| oneof 안 쓰고 다수 nullable 필드 | 의미 모호 + wire 낭비 |

## 다음 학습

- [03-proto3-defaults-optional.md](03-proto3-defaults-optional.md) — proto3 의 default 처리 + optional 부활
- [07-protobuf-wire-format.md](07-protobuf-wire-format.md) — varint / tag-wire-type / packed
- [08-schema-evolution.md](08-schema-evolution.md) — field number 불변 / reserved / oneof 진화
