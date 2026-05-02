---
parent: 18-grpc
seq: 01
title: RPC vs REST — 추상화 차이와 트레이드오프
type: deep
created: 2026-05-01
---

# 01. RPC vs REST

## 1. 추상화의 차이

REST 와 RPC 는 단순히 "포맷이 다르다" 가 아니라 **클라이언트가 서버를 어떻게 모델링하느냐** 가 다르다.

| 축 | REST | RPC (gRPC) |
|---|---|---|
| 추상화 단위 | **리소스** (명사) | **함수** (동사) |
| URL 의미 | `/products/123` 가 그 자체로 식별자 | endpoint 는 단순 라우팅 키 |
| 동작 | HTTP 메서드 (GET/POST/PUT/DELETE) 가 의미 | proto 의 RPC 이름 |
| 메시지 형식 | 보통 JSON | Protobuf (binary) |
| 스키마 | 보통 별도 (OpenAPI) — 코드와 동기화 보장 약함 | proto 파일이 single source of truth |
| 클라이언트 | HTTP 라이브러리 + DTO 수동 매핑 | 자동 생성 stub (`getProduct(req): Resp`) |
| 캐시 | HTTP 캐시 / CDN 친화적 | 캐시 비친화 (binary, semantics 불명확) |

**핵심**: REST 는 *상태를 표현* 하고, RPC 는 *동작을 호출* 한다. 같은 기능 (`getProduct(123)` vs `GET /products/123`) 도 RPC 는 함수 시그니처가 1급, REST 는 리소스 식별이 1급.

## 2. 함수 호출의 가상화

RPC 의 본질은 **로컬 함수 호출처럼 보이게 하는 것** 이다.

```kotlin
// 클라이언트 코드 — 로컬 함수 호출처럼 보이지만 실제로는 네트워크 RPC
val response: ProductResponse = productStub.getProduct(
    GetProductRequest.newBuilder().setId(123).build()
)
```

내부에서 일어나는 일:
1. Stub 이 request 를 Protobuf 로 직렬화
2. HTTP/2 stream 시작, `:path = /commerce.ProductService/GetProduct` 헤더 송신
3. 서버가 dispatch 후 응답 직렬화 / stream 종료
4. Stub 이 응답을 deserialize 후 반환

**Fallacies of Distributed Computing** — RPC 의 추상화는 *로컬과 같다* 는 환상을 만드는데, 실제로는:
- Network is reliable → ❌ (timeout, partition)
- Latency is zero → ❌ (ms 단위)
- Bandwidth is infinite → ❌ (HPACK, flow control 필요)
- Topology doesn't change → ❌ (LB / failover)

⇒ RPC 라이브러리는 결국 timeout / retry / circuit breaker / cancel 을 *명시적* 으로 노출해야 함. 이를 추상화로 가린 시스템 (Java RMI, EJB) 들이 다 실패한 이유.

## 3. 결합도 (coupling) 의 종류

| 결합 종류 | REST | gRPC |
|---|---|---|
| 데이터 형식 결합 | JSON 키 이름 일치 필요 (느슨) | proto field number 일치 필요 (강함) |
| 시간 결합 | 동기 (요청-응답) | 동기 (Unary / Server-stream) + 양방향 가능 |
| 위치 결합 | URL 알아야 함 | 호스트:포트 + 서비스 이름 |
| 버전 결합 | URL 버전 (`/v1/`, `/v2/`) | proto 의 reserved / oneof 로 관리 |
| 코드 결합 | DTO 수동 동기화 (drift 가능) | stub 자동 생성 (compile-time 일치) |

**오해**: "REST 는 느슨하고 gRPC 는 강하다" → 데이터 측면은 맞지만 **시간/위치 결합** 은 둘 다 동기 RPC 면 같다. 진짜 느슨함은 Kafka 같은 *메시지 브로커* 에서 나옴 (시간 + 위치 분리).

## 4. 성능 차이의 근원

흔한 벤치 결과: gRPC 가 REST/JSON 대비 *3-10x 작은 페이로드, 5-100x 빠른 직렬화*. 그러나 이 숫자는 **층별로 분해해서 봐야** 정확하다.

| 절감 항목 | 근원 |
|---|---|
| 페이로드 크기 | (a) Protobuf binary, (b) varint 가변 길이, (c) 필드명 미전송 |
| 직렬화 속도 | (a) 사전 컴파일된 코드, (b) reflection 없음, (c) UTF-8 검증 / escape 없음 |
| 다중 요청 처리 | HTTP/2 multiplexing (한 TCP 위 여러 stream 동시) |
| 헤더 오버헤드 | HPACK 압축 (반복 헤더 무료에 가까움) |
| Streaming | 네이티브 (요청-응답 N:M 가능, REST 는 SSE/WebSocket 대체) |

**주의**: `application/json` + HTTP/2 + 무손실 압축 (gzip/zstd) 으로도 REST 의 페이로드 격차는 상당 부분 좁힐 수 있다. 진짜 격차는 **schema 일치 보장 + streaming 네이티브** 두 가지가 결정적.

## 5. 캐시 / 게이트웨이 친화성

REST 는 HTTP 의 광범위한 인프라 (CDN, reverse proxy, browser cache, OpenAPI 도구) 를 그대로 활용. gRPC 는:

- **CDN / reverse proxy 캐시 ❌** — 메시지가 binary 라 일반 CDN 이 의미 해석 불가, idempotent 표시도 약함
- **브라우저 직접 호출 ❌** — gRPC-Web 필요 (Envoy 프록시 변환)
- **curl / Postman 미지원** — `grpcurl` 같은 별도 도구
- **로그 / 디버깅** — 평문 가시성 낮음 (서버 로그에 protobuf 디코딩 필요)

⇒ 외부 공개 API (3rd party) 에는 REST 가 여전히 우세, 내부 (서비스 간) 에는 gRPC 가 적합.

## 6. 의사결정 트리

```
질문: 호출자가 누구인가?
 │
 ├─ 외부 (브라우저 / 3rd party) ─→ REST + OpenAPI
 │   └─ (브라우저에서도 강한 schema 필요) ─→ GraphQL or gRPC-Web
 │
 ├─ 내부 (다른 서비스, 같은 회사) ─→ 다음 질문
 │   ├─ 동기 + low latency 필요 ─→ gRPC 후보
 │   ├─ 비동기 / 이벤트 기반 ─→ Kafka
 │   └─ 단순 / 트래픽 적음 ─→ REST 유지 (학습 비용 < 이득)
 │
 └─ 모바일 앱 ─→ 둘 다 가능, gRPC 가 배터리/대역폭에 유리
```

## 7. msa 현재 상태 (참고)

- 서비스 간 동기 호출: **WebClient (Reactor 기반)** + Resilience4j CircuitBreaker
- 비동기: Kafka (`{domain}.{entity}.{event}` 토픽)
- ADR-0003 명시: "**gRPC: Protocol Buffer 관리 부담, 팀 학습 비용**" 이유로 미채택
- 도입 시 가장 큰 이득 후보: gateway↔auth (인증 latency), order↔inventory (예약/차감 핫패스), search 인덱싱 (대량 페이로드)

## 8. 자주 듣는 오해 정정

> **"gRPC 는 REST 의 상위호환이다"**

- 아니다. **호출자/네트워크/도구체계** 가 다르다. CDN 캐시 / 브라우저 친화 / 디버깅 편의는 REST 가 우세.

> **"REST 도 Protobuf 쓰면 비슷하다"**

- 페이로드 크기는 비슷해진다. 그러나 **streaming 네이티브 + schema-first 코드 생성 + deadline propagation** 은 gRPC 만의 패키지 가치.

> **"gRPC 는 어렵다"**

- 코드 작성은 오히려 단순 (DTO 자동 생성). 어려움은 **운영** (LB, mTLS, 디버깅 도구 부족) 에 집중됨 → 이게 학습 비용의 본질.

## 다음 학습

- [02-protobuf-idl.md](02-protobuf-idl.md) — proto3 IDL 문법
- [04-grpc-call-patterns.md](04-grpc-call-patterns.md) — 4가지 호출 패턴 (특히 streaming 이 REST 와 갈라지는 지점)
- [14-tradeoffs.md](14-tradeoffs.md) — 도입 의사결정 종합
