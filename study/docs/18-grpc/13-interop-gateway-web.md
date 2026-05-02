---
parent: 18-grpc
seq: 13
title: 상호운용 — grpc-gateway · gRPC-Web · Envoy transcoder
type: deep
created: 2026-05-01
---

# 13. 상호운용 (gRPC ↔ REST / 브라우저)

> gRPC 의 한계 = 브라우저가 직접 못 쏘고, 외부 3rd party 가 REST 를 기대. 이를 메우는 3가지 패턴.

## 1. 왜 상호운용이 필요한가

| 호출자 | gRPC 직접? | 비고 |
|---|---|---|
| 다른 백엔드 서비스 (같은 회사) | ✅ | 표준 |
| 모바일 native | ✅ | grpc-java/swift 사용 |
| 브라우저 (XHR / fetch) | ❌ | 직접 HTTP/2 trailers 제어 불가 |
| 3rd party (외부 통합) | △ | gRPC 채택 적음, REST 기대 |
| curl / Postman | △ | grpcurl 가능하나 일반인 X |

⇒ 외부 (브라우저, 3rd party) 와 내부 (gRPC) 사이에 **변환 계층** 이 필요.

## 2. gRPC-Web — 브라우저에서 직접

### 2-1. 무엇

- 브라우저는 HTTP/2 trailers / streaming 을 fetch API 가 제어 못 함
- gRPC-Web = gRPC 메시지를 **HTTP/1.1 (또는 2) 호환 프레이밍** 으로 변형
- 브라우저 → Envoy / grpcwebproxy → gRPC 백엔드

```
Browser (gRPC-Web JS)
   │  HTTP/1.1 또는 H2
   │  Content-Type: application/grpc-web+proto
   ▼
Envoy (with grpc_web filter)
   │  HTTP/2 + gRPC native
   ▼
Backend gRPC server
```

### 2-2. 차이점

| 항목 | gRPC native | gRPC-Web |
|---|---|---|
| transport | HTTP/2 | HTTP/1.1 또는 2 |
| Content-Type | `application/grpc` | `application/grpc-web` (proto) 또는 `application/grpc-web-text` (base64) |
| trailers | HTTP/2 trailers | body 끝에 trailer 프레임 인코딩 (compatible 트릭) |
| streaming | 4 패턴 모두 | server-streaming까지만 (client-stream, bidi 미지원 상태가 길었음, 부분적 진전) |
| 브라우저 지원 | ❌ | ✅ |

### 2-3. 클라이언트 (TypeScript)

```typescript
import { ProductServiceClient } from "./generated/product_grpc_web_pb";
import { GetProductRequest } from "./generated/product_pb";

const client = new ProductServiceClient("https://api.example.com", null, null);
const req = new GetProductRequest();
req.setId(123);

client.getProduct(req, {}, (err, resp) => {
  if (err) console.error(err.code, err.message);
  else console.log(resp.getProduct());
});
```

코드 생성:
```bash
protoc --js_out=import_style=commonjs:./gen \
       --grpc-web_out=import_style=commonjs,mode=grpcwebtext:./gen \
       product.proto
```

### 2-4. Envoy 의 grpc_web filter

```yaml
http_filters:
- name: envoy.filters.http.grpc_web
- name: envoy.filters.http.cors
- name: envoy.filters.http.router
```

- grpc_web filter 가 frame 변환
- CORS 도 보통 활성화 (브라우저 origin 제한)

### 2-5. msa 도입 시 고려

- 관리 페이지 (admin) 에서 백엔드 gRPC 호출 시 의미
- 일반 storefront 는 BFF / REST 가 더 자연스러움
- proto 가 BFF 와 브라우저까지 공유되는 강한 schema 가 이득일 때만 검토

## 3. grpc-gateway — gRPC ↔ REST/JSON 자동 매핑

### 3-1. 무엇

- proto 파일에 HTTP 매핑 어노테이션을 달면 grpc-gateway 가 REST/JSON ↔ gRPC 변환 코드 생성
- 백엔드는 gRPC 만 구현, REST 는 gateway 가 자동
- Go 로 작성된 reverse proxy (Java 진영도 사용 가능)

### 3-2. proto 어노테이션

```protobuf
import "google/api/annotations.proto";

service ProductService {
  rpc GetProduct(GetProductRequest) returns (GetProductResponse) {
    option (google.api.http) = {
      get: "/api/products/{id}"
    };
  }

  rpc CreateProduct(CreateProductRequest) returns (Product) {
    option (google.api.http) = {
      post: "/api/products"
      body: "product"
    };
  }
}

message GetProductRequest {
  int64 id = 1;
}
```

- `GET /api/products/123` → gRPC `GetProduct(id=123)`
- `POST /api/products` body → `CreateProduct(...)`
- 응답은 protobuf-json 으로 변환 (camelCase 기본)

### 3-3. 아키텍처

```
External REST client
   │  GET /api/products/123
   ▼
grpc-gateway (Go reverse proxy)
   │  gRPC GetProduct(id=123)
   ▼
Backend gRPC server
```

장점:
- 백엔드는 gRPC 단일 구현
- OpenAPI 자동 생성 (`protoc-gen-openapiv2`)
- 외부에 REST 노출 + 내부 gRPC 활용 둘 다

단점:
- 추가 hop / 운영 컴포넌트
- Go 의존성 (Java 팀이라면 어색)
- HTTP/REST 의 idiom (PATCH, partial update) 매핑이 항상 깔끔하진 않음

## 4. Envoy gRPC-JSON Transcoder

### 4-1. 무엇

- Envoy 의 filter 로 grpc-gateway 와 거의 동일한 기능
- 별도 컴포넌트 없이 Envoy 만으로 REST↔gRPC 변환
- `proto descriptor` 파일을 Envoy 에 로드

### 4-2. 설정

```yaml
http_filters:
- name: envoy.filters.http.grpc_json_transcoder
  typed_config:
    "@type": type.googleapis.com/envoy.extensions.filters.http.grpc_json_transcoder.v3.GrpcJsonTranscoder
    proto_descriptor: "/etc/envoy/product.pb"
    services: ["commerce.product.v1.ProductService"]
    print_options:
      add_whitespace: true
      always_print_primitive_fields: true
```

`product.pb` 는 `protoc --include_imports --include_source_info --descriptor_set_out=product.pb product.proto` 로 생성.

### 4-3. 비교

| 항목 | grpc-gateway | Envoy transcoder |
|---|---|---|
| 컴포넌트 | 별도 reverse proxy | Envoy 의 filter |
| 언어 | Go | Envoy 자체 |
| 운영 부담 | 추가 컨테이너 | Envoy 에 통합 |
| OpenAPI 생성 | ✅ | ❌ (직접) |
| 설정 위치 | proto 어노테이션 | proto 어노테이션 |
| 서비스 메시 환경 | 별도 hop | sidecar 가 처리 |

⇒ 이미 Envoy / Istio 사용 중이면 **transcoder 가 깔끔**, 그 외엔 grpc-gateway 가 단순.

## 5. Connect — 더 단순한 대안

[Connect](https://connectrpc.com/) (Buf 가 만든) = gRPC-Web 의 더 간단한 대안.

특징:
- gRPC, gRPC-Web, REST/JSON 셋 다 한 서버가 동시 지원
- HTTP/1.1 친화 (curl 로 직접 호출 가능)
- proto 그대로 사용
- Go / TypeScript / Swift / Kotlin 클라이언트

```bash
# Connect 는 curl 로 직접 호출 가능 (gRPC native 는 불가)
curl -X POST https://api.example.com/commerce.product.v1.ProductService/GetProduct \
  -H "Content-Type: application/json" \
  -d '{"id": 123}'
```

장점:
- gRPC + REST + brouwers 모두 한 라이브러리
- curl / Postman 친화 (디버깅 용이)
- gRPC-Web 보다 단순한 wire format

단점:
- 기존 gRPC 라이브러리와 별도 (재학습 비용)
- Java 진영 라이브러리 미성숙

→ msa 가 새로 시작한다면 **Connect 도 후보**. 단 Java 생태계가 약하면 부담.

## 6. msa 의 BFF (Backend-for-Frontend) 와 결합

현재 msa: gateway (Spring Cloud Gateway) 가 외부 REST → 내부 REST 라우팅.

### 시나리오 A — gateway 가 변환

- gateway 가 외부 REST 받음
- 내부 호출은 gRPC (gateway 자체가 gRPC client)
- 코드 작성: gateway 에 stub 필요, RPC 별 라우팅 / 변환 로직

### 시나리오 B — Envoy transcoder

- gateway → Envoy (transcoder filter) → gRPC 서비스
- gateway 는 그대로 REST proxy 역할
- 변환 로직은 Envoy 가 수행

### 시나리오 C — 별도 BFF 서비스

- 외부용 BFF 가 REST 응답
- 내부 호출은 gRPC
- 도메인 별 BFF 가능 (mobile, web, partner)

→ msa 의 점진적 도입에는 **A 또는 C 가 자연스러움**. B 는 mesh 도입 후.

## 7. 보안 / TLS 종단

| 패턴 | TLS 종단 |
|---|---|
| 외부 REST → grpc-gateway → gRPC | gateway 에서 TLS 종단, 내부는 mTLS 별도 |
| 외부 REST → Envoy transcoder → gRPC | Envoy 에서 TLS, 내부 mTLS (mesh) |
| 외부 gRPC-Web → Envoy → gRPC native | Envoy 에서 TLS |

⇒ 외부 TLS 와 내부 mTLS 의 종단 위치는 **명확히 분리** 권장.

## 8. 도구 비교 요약

| 시나리오 | 도구 |
|---|---|
| 브라우저 → 백엔드 (강한 schema) | gRPC-Web (Envoy proxy) |
| 외부 3rd party REST | grpc-gateway 또는 Envoy transcoder |
| 모바일 native | gRPC native |
| 디버깅 / curl 친화 | Connect 또는 별도 REST endpoint |
| 메시 환경 | Envoy transcoder |
| 메시 미사용 | grpc-gateway |

## 9. msa 도입 시 권장

- 단기 (Phase 1-2): 외부 = REST 그대로, 내부만 gRPC. 변환 불필요
- 중기 (Phase 3): 핫패스에 BFF 가 gRPC client 가 됨
- 장기 (Phase 4): mesh + transcoder 로 변환 일원화 (mesh 도입 의사결정에 종속)

## 10. 흔한 함정

| 함정 | 결과 |
|---|---|
| 모든 RPC 를 gRPC + 외부 REST 둘 다 노출 | 운영 비용 ↑, schema 불일치 위험 |
| grpc-gateway 의 PATCH 매핑 누락 | partial update 표현 불가 |
| transcoder 가 binary 응답을 base64 로 안 변환 | 클라 파싱 실패 |
| gRPC-Web 의 streaming 한계를 모름 | client-stream / bidi 시도 → 동작 안 함 |
| CORS 설정 누락 | 브라우저에서 차단 |

## 11. 면접 핵심

> Q: 브라우저에서 gRPC 를 직접 못 쓰는 이유는?

A: 브라우저의 fetch / XHR 은 HTTP/2 trailers 를 제어할 수 없고, gRPC 의 streaming framing 도 처리 불가. 해결: gRPC-Web — HTTP/1.1 호환 변형 framing 으로 메시지 전달, Envoy 가 native gRPC 로 변환.

> Q: REST 호환을 위한 두 옵션은?

A: (1) grpc-gateway — 별도 Go reverse proxy + proto 어노테이션. OpenAPI 자동 생성. (2) Envoy gRPC-JSON Transcoder — Envoy filter 로 동일 기능 + 메시 환경에 자연스럽게 통합. 어느 쪽이든 proto 의 `google.api.http` 어노테이션이 매핑 정의.

> Q: msa 같은 환경에 gRPC 도입 시 외부 API 처리?

A: 백엔드 간 gRPC + 외부 REST 분리 운영. gateway 가 외부 REST 받고 내부 gRPC stub 사용 (시나리오 A) 또는 도메인별 BFF (시나리오 C). 메시 도입 시 transcoder 로 통합 가능. 단계적 — 외부까지 한 번에 변경하지 말 것.

## 다음 학습

- [14-tradeoffs.md](14-tradeoffs.md) — 모든 운영 트레이드오프 종합
- [15-msa-hot-paths.md](15-msa-hot-paths.md) — msa 핫패스 식별
