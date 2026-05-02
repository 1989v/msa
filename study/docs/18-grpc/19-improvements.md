---
parent: 18-grpc
seq: 19
title: gRPC 도입 검토 ADR 초안 — 보류 / 부분 / 전면 옵션 비교
type: adr-draft
created: 2026-05-01
---

# 19. gRPC 도입 검토 ADR 초안

> 본 문서는 `docs/adr/` 의 정식 ADR 후보. 학습 결과를 정리하여 의사결정 근거 + 옵션 비교 + 추천을 담았다. 그대로 ADR 로 승격 가능하도록 형식 준수.

---

## ADR-XXXX: 서비스 간 통신에 gRPC 부분 도입 검토

## Status

**Proposed**

- **Date**: 2026-05-01
- **Authors**: kgd
- **Related**:
  - ADR-0003 (서비스 간 통신 방식 — REST + Kafka 의 현 결정)
  - ADR-0011 (inventory + fulfillment 서비스 — 동기/비동기 분리)
  - ADR-0015 (resilience strategy — Circuit Breaker / DLQ / RateLimit)
  - ADR-0019 (K8s 마이그레이션 — k3s-lite / prod-k8s 모드)
  - ADR-0025 (latency budget — Tier 1 P99 SLA)

## Context

ADR-0003 (2024) 에서 서비스 간 동기 통신은 **WebClient + Resilience4j**, 비동기는 **Kafka** 로 결정. gRPC 는 *학습 비용 + Protocol Buffer 관리 부담* 사유로 미채택.

2026 시점에 다음 3가지 변경이 발생:

1. **K8s 정착 (ADR-0019)** — Eureka 제거, ClusterIP / headless service 운영 가능. Service Mesh 도입도 옵션.
2. **Latency budget 가시화 (ADR-0025)** — Tier 1 P99 SLA + fan-out 영향 사전 검토 강제. tail latency 의 곱셈 효과 인식.
3. **서비스 수 / 의존성 확대** — 10+ 서비스 (inventory / fulfillment / member / wishlist / experiment / quant / chatbot 등) 가 추가되며 schema drift 위험 증가.

본 ADR 은 **gRPC 도입 여부와 범위** 를 재검토한다.

## Decision Drivers

| 드라이버 | 우선순위 |
|---|---|
| 사용자 SLA 의 P99 (ADR-0025) | 높음 |
| schema 일관성 (서비스 간 DTO drift) | 높음 |
| 운영 복잡도 (mesh / LB / 디버깅) | 중간 |
| 학습 곡선 (proto / stub / status 분류) | 중간 |
| 외부 API / 브라우저 호환성 (gRPC 의 약점) | 높음 (기존 REST 보존 필요) |

## Considered Options

### 옵션 1 — 보류 (ADR-0003 유지)

- 모든 서비스 간 동기 호출은 WebClient + Resilience4j
- 비동기는 Kafka (그대로)
- 변경 없음

### 옵션 2 — 부분 도입 (Hot Path 한정)

- 핫패스 일부에 gRPC 도입 (Phase 0 → 1 → 2 점진)
- 외부 API / 브라우저 노출은 REST 유지
- proto 모듈 (`:proto-commerce`) + Buf lint/breaking CI

### 옵션 3 — 전면 전환

- 모든 서비스 간 동기 호출을 gRPC 로
- gateway 가 외부 REST ↔ 내부 gRPC 변환
- mesh (Istio / Linkerd) 도입 동시 진행

## Comparison

| 차원 | 옵션 1 (보류) | 옵션 2 (부분) | 옵션 3 (전면) |
|---|---|---|---|
| Latency 절감 (핫패스) | 0 | 1-2ms / hop, deadline propagation | 전체 hop |
| Schema drift 위험 ↓ | 0 | 도입 페어만 | 전체 |
| 학습 비용 | 0 | 1-2주 / 팀 | 4-8주 / 팀 |
| 인프라 변경 | 0 | proto 모듈 + 클라/서버 starter | mesh + 인증서 + 정책 |
| 운영 부담 | 0 | + 메트릭 panel, 디버깅 도구 | + mesh control plane |
| 롤백 가능성 | n/a | 양립 운영으로 즉시 | 어려움 |
| 외부 API 영향 | 0 | 0 | 변환 계층 필요 |
| ADR-0025 SLA 강화 | △ | ✅ deadline propagation | ✅ |

## Decision

**옵션 2 — 부분 도입 (Hot Path 한정)** 을 채택 (Proposed).

근거:
1. ADR-0025 의 fan-out tail 보호 가치를 가장 효율적으로 확보 (점진)
2. ADR-0003 의 외부 / 비동기 결정은 그대로 유지 (변경 최소)
3. 옵션 3 (전면 + mesh) 는 변수가 많아 실패 시 롤백 어려움 — *한 번에 한 변수* 원칙 위배
4. POC (Phase 0) 가 데이터 부족 시 옵션 1 으로 회귀 가능

## Decision Details

### 1. 도입 범위 (Phase 별)

#### Phase 0 — POC (2주)

- **대상**: `order → product.getProduct` 단일 RPC
- **인프라**: `:proto-commerce` 모듈 + `grpc-spring-boot-starter` (server + client)
- **K8s**: headless service `product-grpc` 추가 (기존 `product` REST service 와 양립)
- **인증**: h2c (no TLS), NetworkPolicy 로 internal 격리
- **토글**: profile 기반 (`grpc` / `rest`), `ProductPort` 인터페이스 동일
- **측정**: P50 / P99 latency, 페이로드 byte, 메모리, 빌드 시간 → 1주 후 평가

**평가 기준** (Phase 1 진행 결정):
- P99 latency 동등 이상
- 양립 운영 안정 (장애 0회)
- 빌드 시간 증가 < 30s
- 팀이 proto / status / 디버깅 도구에 적응

#### Phase 1 — 핫패스 1-3 쌍 (1개월)

- **추가 대상**:
  - `gateway → auth` (high RPS, deadline propagation)
  - `order → inventory` (ADR-0011 의 동기 부분, 핫패스)
- **인증**: JWT metadata propagation (gateway 가 검증, 내부는 metadata 로 user_id 전파)
- **CI**: Buf lint + breaking detection 도입

#### Phase 2 — 확산 (3개월)

- **추가 대상**:
  - `search-batch → product` (server-streaming 으로 페이지네이션 단순화)
  - `auth → member` (refactor 기회 — 현 코드가 `block()` 사용)
  - `experiment → analytics` (schema drift 자주)
- **거버넌스**: proto 변경 시 양 도메인 owner approve 정책

#### Phase 3 — 선택 (mesh)

- 6개월 후 재평가. mesh 도입은 별도 ADR.
- mesh 가 없어도 옵션 2 의 가치는 유지.

### 2. 도입 *제외* 범위

- 외부 API (Kakao OAuth, Google OAuth, 결제 PG, Bithumb, Slack, Claude API)
- 브라우저 직접 호출 (REST 유지)
- 비동기 이벤트 흐름 (Kafka 유지) — `*.outbox` / `*.event` / `*.placed` 등
- 현재 트래픽이 낮은 호출 (ROI 부재)

### 3. proto 거버넌스

- 위치: monorepo 의 `proto/` 디렉토리 + `:proto-commerce` 모듈
- 패키지: `commerce.<domain>.v1` (Java: `com.kgd.proto.commerce.<domain>.v1`)
- Buf lint (STANDARD) + breaking detection (FILE) — PR CI 강제
- major 변경 시 `v2` 패키지 신설 + deprecated v1 6개월 유지 정책
- 변경 시 양 도메인 owner approve 필수

### 4. 인증 / 보안

- Phase 0-1: h2c (no TLS) + NetworkPolicy
- Phase 2: TLS 종단 = gateway, 내부는 평문 (NetworkPolicy 로 격리)
- Phase 3 (mesh 도입 시): 자동 mTLS + AuthorizationPolicy

### 5. Resilience 통합

- ADR-0015 의 Circuit Breaker 는 그대로 유지 — gRPC stub 호출도 `circuitBreaker.executeSuspendFunction { ... }` 로 wrap
- gRPC service config 의 retry policy = `UNAVAILABLE` 만 transparent retry, max 3회, exponential backoff
- 멱등 RPC 만 retry, write RPC 는 idempotency key 패턴
- DLQ 는 Kafka 영역이라 영향 없음

### 6. 에러 매핑

- ServerInterceptor 가 BusinessException → gRPC Status 변환 (NOT_FOUND, INVALID_ARGUMENT, UNAUTHENTICATED 등)
- ClientInterceptor 가 StatusException → BusinessException 역변환
- 풍부한 에러는 `google.rpc.Status.details` (BadRequest, RetryInfo) 활용

### 7. 측정 / 모니터링

- Micrometer + grpc-spring-boot-starter 자동 메트릭
  - `grpc_server_handled_total`, `grpc_server_handling_seconds_bucket`
  - `grpc_client_completed_total`, `grpc_client_completed_seconds_bucket`
- Grafana panel: gRPC method 별 P50/P99 latency, 에러율, RPS
- ADR-0025 의 PR 체크리스트에 "gRPC 사용 여부" 추가

### 8. ADR-0003 갱신

- "동기 통신 = WebClient + Resilience4j" → "**WebClient or gRPC** + Resilience4j"
- 선택 기준: 본 ADR 의 Phase 별 도입 범위 참조

## Alternatives Considered (in Detail)

### 1. 보류 (옵션 1) — 거부

- 거부 이유: ADR-0025 의 P99 SLA 와 fan-out tail 보호의 가치가 명확하나 REST 만으로 deadline propagation 표준화 불가. schema drift 위험은 누적 중.
- 단, 옵션 2 의 Phase 0 POC 결과 ROI 부재 시 옵션 1 회귀 가능 (롤백 비용 작음).

### 2. 전면 전환 + mesh (옵션 3) — 거부

- 거부 이유: 한 번에 mesh + gRPC + 인증 변경 동시 진행 시 변수 많음 → 장애 시 원인 분리 불가. 한 번에 한 변수 원칙 위배.
- mesh 는 옵션 2 정착 후 별도 ADR 로 검토.

### 3. Connect (Buf 의 단순화 RPC) 채택 — 거부

- gRPC + REST + curl 친화의 통합 라이브러리
- 거부 이유: Java/Kotlin 생태계 미성숙 (2026 현재). 표준 gRPC 의 학습 자산 / 도구 / 인재 풀이 더 큼. Connect 는 Phase 3 이후 재평가.

### 4. GraphQL 도입 — 거부

- 본 ADR 의 범위 밖. GraphQL 은 BFF 레벨 (BFF → 프론트) 에 적합. 서비스 간 동기 RPC 의 대체로는 부적합.

## Consequences

### Positive

- ADR-0025 의 P99 SLA 와 deadline propagation 정합
- Schema drift 제거 (proto 모듈 + Buf CI)
- 핫패스 latency / 페이로드 절감 (측정 후 결정)
- 인재 / 도구 생태계 확장 (gRPC 경험)
- Phase 3 mesh 도입의 자연스러운 발판

### Negative

- 학습 곡선 (1-2주 / 팀)
- 빌드 시간 +5-10s / 서비스
- 운영 복잡도 ↑ (포트 / 디버깅 / 메트릭 panel)
- 양립 운영 1-2주의 인지 부담
- proto 거버넌스 프로세스 추가 (PR review)

### Neutral

- ADR-0003 의 Kafka 결정 영향 없음
- 외부 API / 브라우저 영향 없음
- 도입 페어 외 서비스 영향 없음

## Validation Plan

### Phase 0 측정 항목

| 메트릭 | 측정 도구 | 기준 |
|---|---|---|
| P50 / P99 latency | Micrometer + Grafana | REST 동등 이상 |
| 페이로드 byte | gRPC interceptor | -30% 이상 |
| 메모리 (heap) | JMX | +20MB 이내 |
| 빌드 시간 | gradle --profile | +30s 이내 |
| 운영 트러블 | 1주 postmortem | 0회 |

### 진행/회귀 결정

- 모두 통과 → Phase 1 진행 + 본 ADR Status `Accepted`
- 일부 미달 → 원인 분석, Phase 0 연장 또는 옵션 1 회귀 + ADR Status `Rejected`

## Implementation Notes

### 의존성 추가 (한 번)

```kotlin
// proto/build.gradle.kts (신규 모듈)
plugins {
    kotlin("jvm")
    id("com.google.protobuf") version "0.9.4"
}
dependencies {
    api("com.google.protobuf:protobuf-kotlin:3.25.3")
    api("io.grpc:grpc-protobuf:1.62.2")
    api("io.grpc:grpc-stub:1.62.2")
    api("io.grpc:grpc-kotlin-stub:1.4.1")
    api("io.grpc:grpc-netty-shaded:1.62.2")
}
```

### 첫 PR 체크리스트 (Phase 0)

- [ ] `:proto-commerce` 모듈 추가
- [ ] `proto/commerce/product/v1/{product,product_service}.proto` 작성
- [ ] product 서버: `ProductGrpcService` 구현 + `@GrpcService` 등록
- [ ] order 클라: `ProductGrpcAdapter` 추가 + `@Profile("grpc")`
- [ ] K8s headless service `product-grpc` (port 9090)
- [ ] application.yml 의 `grpc.client.product-grpc` 설정
- [ ] Grafana panel 추가
- [ ] 양립 운영 1주 메트릭 비교 dashboard 준비
- [ ] (선택) Buf lint/breaking CI workflow 추가

### Rollback 전략

- profile 토글로 즉시 REST 복귀
- proto 변경 issue → git revert (호환 깨짐 없음 가정)
- K8s service / deployment 의 grpc 포트 제거 = 1 PR

## Open Questions

1. POC 에서 stream 패턴 (search-batch → product) 도 함께 검증할지? — 추천: Phase 0 은 Unary 만, Phase 1 후반에 stream 추가
2. mesh 도입 시점 — Phase 2 종료 후 별도 ADR
3. BSR (Buf Schema Registry) 도입 — 외부 공개 API 가 생기는 시점에 재검토
4. 외부 노출 (admin BFF) 에 gRPC-Web — Phase 2-3 검토

## References

- [04-grpc-call-patterns.md](04-grpc-call-patterns.md)
- [10-load-balancing.md](10-load-balancing.md)
- [14-tradeoffs.md](14-tradeoffs.md)
- [15-msa-hot-paths.md](15-msa-hot-paths.md)
- [17-proto-monorepo-strategy.md](17-proto-monorepo-strategy.md)
- [18-virtual-migration-product.md](18-virtual-migration-product.md) — POC 코드 시안

---

> 본 문서를 그대로 `docs/adr/ADR-NNNN-grpc-partial-adoption.md` 로 승격할 수 있도록 작성. 번호 / 제목은 합의 후 부여.
