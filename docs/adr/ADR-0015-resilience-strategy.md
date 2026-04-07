# ADR-0015 장애 대비 및 복원력 전략

## Status
Accepted

## Context

MSA 환경에서 서비스 간 통신 실패, 인프라 장애, 트래픽 폭증에 대비한 일관된 복원력 전략이 필요하다.
현재 프로젝트에 적용된 패턴과 향후 적용할 패턴을 통합 정리한다.

## Decision

### 1. Circuit Breaker (서킷 브레이커)

**적용 대상**: 서비스 간 동기 API 호출 (WebClient 기반)

**라이브러리**: Resilience4j

**설정 기준**:

| 파라미터 | 기본값 | 설명 |
|---------|--------|------|
| slidingWindowType | COUNT_BASED | 최근 N건 기준 |
| slidingWindowSize | 10 | 평가 대상 호출 수 |
| failureRateThreshold | 50% | 실패율 임계치 → OPEN |
| waitDurationInOpenState | 30초 | OPEN 상태 유지 시간 |
| permittedNumberOfCallsInHalfOpenState | 3 | HALF_OPEN에서 허용 호출 수 |

**상태 전이**:
```
CLOSED → (실패율 50% 초과) → OPEN → (30초 대기) → HALF_OPEN → (3건 테스트)
  ↑                                                              ↓
  └────────────────── (성공률 정상) ─────────────────────────────┘
```

**적용 서비스**:

| 호출자 | 대상 | CircuitBreaker 이름 |
|--------|------|-------------------|
| order-service | payment (외부) | `payment-service` |
| order-service | product-service | `product-service` |

**코드 패턴**:
```kotlin
@Component
class XxxAdapter(
    @Qualifier("xxxWebClient") private val webClient: WebClient,
    private val circuitBreakerRegistry: CircuitBreakerRegistry,
) : XxxPort {
    private val cb = circuitBreakerRegistry.circuitBreaker("xxx-service")

    override suspend fun call(): Result {
        return cb.executeSuspendFunction {
            webClient.get().uri("/api/...").retrieve()
                .bodyToMono(Result::class.java).awaitSingle()
        }
    }
}
```

**장애 시 행동**:
- OPEN 상태: `CallNotPermittedException` → `BusinessException(ErrorCode.CIRCUIT_BREAKER_OPEN)` 변환
- 호출자는 이를 받아 적절히 처리 (주문 취소, 재시도 안내 등)

---

### 2. Dead Letter Queue (DLQ)

**적용 대상**: 모든 Kafka Consumer

**메커니즘**: Spring Kafka `DefaultErrorHandler` + `DeadLetterPublishingRecoverer`

**정책**:

| 파라미터 | 값 | 설명 |
|---------|---|------|
| 재시도 간격 | 1초 (FixedBackOff) | 고정 간격 |
| 최대 재시도 | 3회 | 3회 실패 후 DLQ |
| DLQ 토픽 | `{원본토픽}.DLT` | Spring Kafka 기본 |
| AckMode | RECORD | 레코드 단위 자동 커밋 |

**DLQ 메시지 처리 전략**:
- Phase 2: DLQ 토픽 적재만 (모니터링)
- Phase 3: DLQ Consumer로 알림 발송 (Slack/이메일)
- Phase 4: DLQ 재처리 API (관리자 수동 재시도)

**멱등성과의 관계**:
DLQ 재처리 시에도 `processed_event` 테이블로 중복 방지가 보장된다.

---

### 3. Rate Limiting (요청 제한)

**적용 대상**: API Gateway (전역) + 개별 서비스 (선택적)

**계층별 전략**:

| 계층 | 방식 | 도구 | 용도 |
|------|------|------|------|
| Gateway | Token Bucket | Spring Cloud Gateway `RequestRateLimiter` + Redis | 전역 API 요청 제한 |
| 서비스 | Resilience4j RateLimiter | 인메모리/Redis | 특정 엔드포인트 보호 |

**Gateway Rate Limiting 설정 기준**:

| 파라미터 | 기본값 | Flash Sale 모드 |
|---------|--------|----------------|
| replenishRate | 100 req/s | 500 req/s |
| burstCapacity | 200 | 1000 |
| requestedTokens | 1 | 1 |
| keyResolver | IP 기반 | User ID 기반 |

**Admission Control (입장 제어)**:
- 재고 예약 API에 선제적 거부 로직 적용
- Redis 카운터로 현재 처리 중인 예약 수를 추적
- `처리 중 예약 > 가용 재고 × 1.2`이면 즉시 거부 (429 Too Many Requests)

---

### 4. CQRS (Command Query Responsibility Segregation)

**적용 대상**: Inventory 재고 조회

**분리 전략**:

```
Command (쓰기): MySQL Master → Inventory 도메인 모델
Query (읽기):  Redis Cache → 비정규화 Read Model
```

**Read Model 구조**:
```
Redis Key: inventory:read:{productId}
Value: { availableQty, reservedQty, lastUpdatedAt }
TTL: 없음 (이벤트 기반 갱신)
```

**갱신 방식**:
- Inventory 서비스에서 재고 변동 시 Redis도 함께 업데이트 (Write-Through)
- Reconciliation 배치로 주기적 정합성 검증

**조회 흐름**:
```
GET /api/inventories/{productId}
  → Redis 조회 (hit → 즉시 반환)
  → Redis miss → DB 조회 → Redis 캐시 → 반환
```

---

### 5. Timeout & Retry

**동기 호출 (WebClient)**:

| 파라미터 | 값 |
|---------|---|
| Connection timeout | 3초 |
| Read timeout | 5초 |
| Retry | CircuitBreaker에 위임 (별도 retry 없음) |

**비동기 이벤트 (Kafka)**:

| 파라미터 | 값 |
|---------|---|
| Producer delivery timeout | 120초 |
| Consumer 재시도 | DLQ 정책 (3회, 1초 간격) |
| Outbox polling fallback | CDC 비활성 시 1초 간격 |

---

### 6. Bulkhead (격벽)

**적용 대상**: 서비스별 스레드 풀 / 커넥션 풀 격리

| 리소스 | 격리 방식 | 설정 |
|--------|---------|------|
| DB Connection Pool | HikariCP per service | max 10, min 2 |
| WebClient | 서비스별 별도 인스턴스 | `@Qualifier`로 분리 |
| Kafka Consumer | Consumer Group 격리 | 서비스별 독립 group |

---

### 7. Graceful Degradation (우아한 성능 저하)

| 장애 상황 | 대응 |
|----------|------|
| Product API 장애 | CircuitBreaker OPEN → 주문 거부 + 메시지 안내 |
| Redis 장애 | DB 직접 조회로 폴백 (CircuitBreaker) |
| Kafka 장애 | Outbox Polling 폴백 (CDC 비활성 시) |
| DB Replica 장애 | Master로 읽기 폴백 (DataSourceConfig) |
| 재고 Redis 불일치 | Reconciliation 배치로 자동 보정 |

---

### 8. Non-Blocking I/O (논블로킹 통신)

**원칙**: 서비스 간 동기 통신(WebClient)은 반드시 논블로킹으로 처리한다.

**표준 패턴** (Order 서비스가 기준):

```kotlin
// Port (application 레이어) — suspend 함수
interface XxxPort {
    suspend fun call(param: T): Result
}

// Adapter (infrastructure 레이어) — awaitSingle()
@Component
class XxxAdapter(
    @Qualifier("xxxWebClient") private val webClient: WebClient,
    private val circuitBreakerRegistry: CircuitBreakerRegistry,
) : XxxPort {
    override suspend fun call(param: T): Result {
        return circuitBreaker.executeSuspendFunction {
            webClient.get().uri("/api/...")
                .retrieve()
                .bodyToMono(Result::class.java)
                .awaitSingle()  // 논블로킹 서스펜션
        }
    }
}

// Controller — suspend endpoint
@PostMapping
suspend fun handle(@RequestBody req: Request): ResponseEntity<ApiResponse<Response>> {
    val result = useCase.execute(req.toCommand())
    return ResponseEntity.ok(ApiResponse.success(Response.from(result)))
}
```

**필수 의존성**:
```kotlin
implementation(libs.spring.webflux)           // WebClient 클래스
implementation(libs.kotlin.coroutines.reactor) // awaitSingle() 브릿지
```

**금지 패턴**:

| 패턴 | 문제 | 대안 |
|------|------|------|
| `.block()` | 서블릿 스레드 차단 → 풀 고갈 | `suspend` + `.awaitSingle()` |
| `runBlocking {}` (Controller/Service) | 서블릿 스레드 차단 | `suspend fun` 전파 |
| `@Transactional` + 외부 API 호출 | DB 커넥션 점유 | TransactionalService 분리 패턴 |

**트랜잭션 격리 패턴**:
```
TX1 (짧은 트랜잭션): savePendingOrder() — DB만, ~1-5ms
→ 외부 API 호출 (트랜잭션 밖, suspend) — 100ms-5s
→ TX2 (짧은 트랜잭션): completeOrder() — DB만, ~1-5ms
```

**예외**: Batch Job에서의 `runBlocking`은 허용 (서블릿 스레드가 아님)

---

### 9. Observability (관측성)

| 항목 | 도구 | 적용 범위 |
|------|------|---------|
| Health Check | Spring Actuator `/health` | 모든 서비스 |
| CircuitBreaker 상태 | Actuator `/circuitbreakers` | 동기 호출 서비스 |
| Kafka Consumer Lag | Kafka metrics | 모든 Consumer |
| DLQ 메시지 수 | Kafka topic monitoring | 모든 DLQ 토픽 |

Phase 4에서 Prometheus + Grafana 대시보드 도입 예정.

## Alternatives Considered

1. **Netflix Hystrix**: 더 이상 유지보수되지 않음. Resilience4j로 대체.
2. **Istio Service Mesh**: 인프라 수준 복원력. 현 규모에서 과도.
3. **AWS Application Load Balancer Rate Limiting**: 클라우드 종속. Gateway 레벨에서 처리.

## Consequences

**긍정적:**
- 장애 전파 차단 (CircuitBreaker)
- 실패 메시지 유실 방지 (DLQ)
- 트래픽 폭증 대응 (Rate Limiting + Admission Control)
- 조회 성능 최적화 (CQRS + Redis)
- 단일 레퍼런스로 일관된 복원력 적용

**부정적:**
- Redis 의존성 증가 (Rate Limiting, CQRS, Admission Control)
- 운영 복잡도 증가 (DLQ 모니터링, Reconciliation)
- 설정값 튜닝 필요 (트래픽 패턴에 따라)

## References

- Kafka DLQ 상세: `docs/architecture/kafka-convention.md`
- CircuitBreaker 구현 패턴: `order/app/.../client/PaymentAdapter.kt`
- Rate Limiting: `gateway/` (Phase 3에서 구현)
- CQRS Read Model: `inventory/app/` (Phase 3에서 구현)
