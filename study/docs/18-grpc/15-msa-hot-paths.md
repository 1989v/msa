---
parent: 18-grpc
seq: 15
title: msa 핫패스 식별 — latency / 처리량 민감 페어
type: deep
created: 2026-05-01
---

# 15. msa 핫패스 식별

> "어디에 적용할까" 가 도입의 본질. 막연하지 않게 코드베이스를 grep 해서 후보를 골라낸다.

## 1. 현재의 서비스 간 동기 호출 (실코드 기반)

`grep -r "WebClient" --include="*.kt"` 로 추출:

| 호출자 | 대상 | 파일 | 패턴 |
|---|---|---|---|
| `order` | `product-service` (조회) | `order/app/.../client/ProductAdapter.kt` | suspend + CB |
| `order` | `payment-service` (외부 결제) | `order/app/.../client/PaymentAdapter.kt` | suspend + CB |
| `auth` | `member-service` (SSO 회원 매핑) | `auth/app/.../client/MemberApiAdapter.kt` | block (refactor 필요) |
| `auth` | Kakao OAuth (외부) | `auth/app/.../client/KakaoOAuthClient.kt` | OAuth 콜백 |
| `auth` | Google OAuth (외부) | `auth/app/.../client/GoogleOAuthClient.kt` | OAuth 콜백 |
| `search-batch` | `product-service` (인덱싱) | `search/batch/.../client/ProductApiClient.kt` | suspend, 페이지네이션 |
| `experiment` | `analytics-service` (메트릭) | `experiment/app/.../client/AnalyticsClient.kt` | block |

코드 패턴 (`order/app/.../ProductAdapter.kt:25-44`):

```kotlin
override suspend fun validateProduct(productId: Long): ProductInfo {
    return circuitBreaker.executeSuspendFunction {
        try {
            val response = webClient.get()
                .uri("/api/products/{id}", productId)
                .retrieve()
                .bodyToMono(ProductApiResponse::class.java)
                .awaitSingle()
            // ... → ProductInfo 변환 ...
        } catch (e: WebClientResponseException.NotFound) {
            throw BusinessException(ErrorCode.NOT_FOUND, ...)
        }
    }
}
```

## 2. 평가 기준 4축

| 축 | 의미 | gRPC 가 이득인 조건 |
|---|---|---|
| **Latency 민감도** | 사용자 SLA 의 지분 | 큰 지분 (체감 차이) |
| **호출 빈도** | RPS | 높을수록 작은 % 절감도 의미 |
| **페이로드 크기** | 평균 / P99 byte | 큰 메시지 → wire 절감 ↑ |
| **Schema drift 위험** | 양 서비스 간 DTO 동기화 | 자주 변경되는 도메인 |

ADR (Architecture Decision Record, 아키텍처 결정 기록) -0025 의 latency budget 도구를 그대로 활용.

## 3. 핫패스 후보 분석

### 3-1. `gateway → auth` (인증 검증)

| 평가 |
|---|
| Latency 민감도: ★★★★★ (모든 사용자 요청) |
| 호출 빈도: 매우 높음 (≈ 전체 RPS) |
| 페이로드: 작음 (token 검증 ~200B in/out) |
| Schema drift: 낮음 |

**판정**: 대량 호출 / latency 핫. 그러나 페이로드 자체는 작아 wire 절감 효과는 크지 않음. **deadline propagation + connection 재사용 (multiplexing)** 이 주된 이득.

→ Phase 1 후보 (도입 시).

### 3-2. `order → product` (상품 검증)

| 평가 |
|---|
| Latency 민감도: ★★★★ (주문 흐름 동기) |
| 호출 빈도: 보통 (주문 생성 시) |
| 페이로드: 작음 (~500B) |
| Schema drift: 보통 (상품 필드 변경 종종) |

**판정**: schema 강제의 가치가 큼 (drift 자주). latency 절감은 부차적. ADR-0011 의 inventory 도입 시 fan-out 이 늘 것 → deadline propagation 가치 ↑.

→ **Phase 0 POC 의 가장 자연스러운 출발점**.

### 3-3. `order → payment` (외부 결제)

| 평가 |
|---|
| Latency 민감도: ★★★★ |
| 호출 빈도: 주문 시 |
| 페이로드: 작음 |
| Schema drift: **외부 API** |

**판정**: 외부 결제 PG 가 gRPC 안 받음. 변경 불가.

→ 제외.

### 3-4. `auth → member` (SSO 회원 매핑)

| 평가 |
|---|
| Latency 민감도: ★★★ (로그인 시 한 번) |
| 호출 빈도: 낮음 (로그인 빈도) |
| 페이로드: 작음 |
| Schema drift: 보통 |

**판정**: latency / 페이로드 이득 작음. 단 현 코드가 `block()` 사용 (suspend 미적용) → refactor 가치는 있음.

→ Phase 2-3 (확산 단계).

### 3-5. `search-batch → product` (인덱싱)

| 평가 |
|---|
| Latency 민감도: ★★ (배치) |
| 호출 빈도: 페이지네이션 다수 호출 |
| 페이로드: **큼** (page size 100 product) |
| Schema drift: 보통 |

**판정**: 처리량 + 페이로드 큰 호출. **server-streaming** 이 자연스러움 (현재 page 기반 → stream 으로 단순화). wire 절감 효과 ★★★★.

→ Phase 1-2 후보, **streaming 활용의 best fit**.

### 3-6. `order → inventory` (재고 예약, 가상 — ADR-0011)

| 평가 |
|---|
| Latency 민감도: ★★★★★ (주문 흐름의 hot synchronous path) |
| 호출 빈도: 주문 시 |
| 페이로드: 작음 |
| Schema drift: 보통 (재고 모델 변경 빈도) |

**판정**: latency / fan-out 측면에서 ★. 현 ADR-0011 은 outbox + Saga choreography 라 동기 호출은 예약 단계만. 그래도 핫패스.

→ Phase 1 (inventory 서비스 등장 시).

### 3-7. `experiment → analytics` (메트릭 조회)

| 평가 |
|---|
| Latency 민감도: ★★ (관리자 화면) |
| 호출 빈도: 낮음 |
| 페이로드: 중간 (메트릭 집계) |
| Schema drift: 높음 (메트릭 필드 자주 변경) |

**판정**: latency 는 부차적. **schema 강제** 의 가치 ↑.

→ Phase 2-3.

## 4. 우선순위 매트릭스

```
                       Schema drift 높음
                              ↑
                              │
       experiment→analytics  │   order→product (POC)
                              │   search-batch→product
                              │
          Latency 낮음 ←──────┼──────→ Latency 높음
                              │
       auth→member            │   gateway→auth
       (refactor)             │   order→inventory
                              │
                              ↓
                       Schema drift 낮음
```

→ **우상단 (latency 높음 + schema drift 높음)** 이 도입 1순위.

## 5. 비도입 후보 (REST 유지)

| 호출 | 이유 |
|---|---|
| 외부 OAuth (Kakao / Google) | 외부 API 변경 불가 |
| 외부 결제 PG | 외부 API |
| Bithumb / Slack / Claude API | 외부 API |
| 매우 낮은 빈도 호출 | ROI 없음 |

## 6. Kafka vs gRPC 분리 (재확인)

현 msa 의 **비동기 이벤트 흐름** 은 **Kafka 가 정답**:

| 호출 | 현 패턴 | gRPC 로 바꾸면? |
|---|---|---|
| `order.placed` → search 인덱스 갱신 | Kafka | ❌ replay / 영속성 손실 |
| `inventory.reserved` → fulfillment 트리거 | Kafka | ❌ Saga choreography 깨짐 |
| `member.created` → analytics 등록 | Kafka | ❌ |
| `experiment.event` ingestion | Kafka | ❌ |

⇒ **gRPC 후보는 동기 RPC 만**. Kafka 자리를 침범하지 않는다. ([16 참조](16-grpc-vs-kafka.md))

## 7. 도입 단계별 계획 (제안)

### Phase 0: POC (2주)

- `order → product` 의 단일 endpoint (`getProduct`) gRPC 추가
- 기존 REST 유지 (이중 운영, toggle)
- 측정: P50 / P99 latency, 페이로드 크기, 메모리, 빌드 시간
- 목표: ROI 데이터 확보

### Phase 1: 핫패스 1-2 쌍 (1개월)

- `order → product` 전체 (REST 폐기 검토)
- `gateway → auth` (high RPS)
- proto monorepo 정착, Buf lint CI
- Resilience4j 와 결합

### Phase 2: 확산 (3개월)

- `search-batch → product` (server-streaming 으로 단순화)
- `order → inventory` (ADR-0011 의 동기 부분)
- `auth → member` (refactor 기회)
- proto monorepo + BSR (or `:proto-commerce` 모듈)

### Phase 3: mesh (선택)

- Istio 또는 Linkerd 도입 의사결정
- 자동 mTLS (mutual TLS, 양방향 TLS) + AuthorizationPolicy
- proto 정의는 그대로, 인증 로직 mesh 로 위임

## 8. 측정 항목 (POC 단계)

| 메트릭 | 측정 방법 |
|---|---|
| P50 / P99 latency (RPC 단위) | Micrometer + `grpc_server_handled_total_bucket` |
| 페이로드 byte | gRPC interceptor 가 frame size logging |
| connection 재사용율 | netstat / ss + grpc-channelz |
| CPU 절감 (직렬화) | flame graph (async-profiler) |
| 빌드 시간 증가 | `./gradlew build --profile` |
| 운영 트러블 빈도 | postmortem 1개월 추적 |

## 9. 위험 요소

| 위험 | 완화 |
|---|---|
| K8s LB 함정 (한 pod 만 받음) | headless service + round_robin 도입 시점에 점검 |
| 디버깅 도구 부재 | `grpcurl`, OpenTelemetry trace 강화 |
| 학습 곡선 (proto, stub, status 분류) | 1-2일 워크숍 + 페어 코딩 |
| 빌드 복잡도 ↑ | `:proto-commerce` 모듈 분리, 빌드 캐시 |
| 양립 운영 (REST + gRPC 병렬) | 한 endpoint 만 시작, 점진 전환 |
| ADR-0003 갱신 필요 | [19 참조](19-improvements.md) — 정식 ADR 갱신 절차 |

## 10. 면접 핵심

> Q: 이 msa 에 gRPC 를 도입한다면 어디부터?

A: 코드베이스 grep 으로 동기 호출 페어를 식별하고, latency / 빈도 / payload / schema drift 4축 평가. 현 시점 우선 후보:
- POC: `order → product` (schema drift 자주, 작은 latency, 단순 endpoint)
- Phase 1: `gateway → auth` (high RPS (Requests Per Second, 초당 요청 수), deadline propagation 가치)
- Phase 1-2: `search-batch → product` (server-streaming 의 best fit)
- 외부 / OAuth (Open Authorization, 인가 프로토콜) / Kafka 자리는 제외

> Q: 모든 호출을 gRPC 로 바꾸지 않는 이유?

A: (1) 외부 API (PG, OAuth) 는 변경 불가, (2) 비동기 영속 흐름은 Kafka 가 정답, (3) latency / 페이로드 / drift 어느 축도 안 걸리는 경우 학습 비용 > 이득, (4) 점진 도입이 표준. ROI 측정 후 확산.

## 다음 학습

- [16-grpc-vs-kafka.md](16-grpc-vs-kafka.md) — 동기/비동기 역할 분리
- [17-proto-monorepo-strategy.md](17-proto-monorepo-strategy.md) — proto 공유 전략
- [18-virtual-migration-product.md](18-virtual-migration-product.md) — POC 코드 시안
