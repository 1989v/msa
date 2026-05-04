---
parent: 8-system-design
type: improvements
order: 12
title: msa 회고에서 도출한 개선 후보
---

# 12. msa 개선 후보

> 10번 e-Commerce 회고와 06번 Rate Limiter 분석에서 도출한 개선 항목. 각각을 ADR (Architecture Decision Record, 아키텍처 결정 기록) 후보 + Phase 별 우선순위로 정리. 면접 시 "이 프로젝트의 다음 단계는?" 질문에 답변용.

---

## 1. 우선순위 매트릭스

| 우선순위 | 항목 | 영향 | 난이도 |
|---|---|---|---|
| **P0** (다음 분기) | Idempotency-Key 명시적 강제 | High | Low |
| **P0** | Rate Limiter Tier 도입 | High | Medium |
| **P0** | Saga 분산 트레이싱 강화 | High | Medium |
| **P1** | Notification Service 신설 | High | High |
| **P1** | Multi-PG 라우팅 | High | High |
| **P1** | Stampede 방어 (캐시) | Medium | Low |
| **P2** | Snowflake / KSUID PK 도입 | High | High |
| **P2** | Service Mesh (Istio) | Medium | High |
| **P2** | Multi-region active-passive | High | High |
| **P3** | LTR 검색 ML | Medium | High |
| **P3** | DLQ 일원화 | Medium | Medium |
| **P3** | Outbox + Debezium 전 서비스 통일 | Medium | Medium |

---

## 2. P0 — 다음 분기 우선

### 2-1. Idempotency-Key 명시적 강제

**현재 상태**: 일부 서비스만 적용, 결제 흐름에 부분 강제.

**개선안**:
```kotlin
// common 모듈에 IdempotencyAspect 추가
@Aspect
@Component
class IdempotencyAspect(private val redis: StringRedisTemplate) {
    @Around("@annotation(Idempotent)")
    fun ensure(pjp: ProceedingJoinPoint): Any? {
        val req = currentRequest()
        val key = req.getHeader("Idempotency-Key")
            ?: throw BusinessException(ErrorCode.IDEMPOTENCY_KEY_REQUIRED)
        val acquired = redis.opsForValue().setIfAbsent("idempo:$key", "1", Duration.ofDays(1))
        if (acquired != true) return cachedResponse(key)
        val result = pjp.proceed()
        cacheResponse(key, result)
        return result
    }
}
```

**적용 대상**: order/payment/inventory의 모든 `@PostMapping`.

**ADR 후보**: ADR-0028 Idempotency Standard.

### 2-2. Rate Limiter Tier 도입

**현재**: gateway에 단일 limiter (100/200) inventory에만 적용.

**개선안** (06번 문서에서 제시):

```kotlin
@Bean
fun tieredRateLimiter(): TieredRateLimiter = TieredRateLimiter(
    tiers = mapOf(
        UserTier.FREE     to RateLimit(rps = 10,   burst = 20),
        UserTier.BASIC    to RateLimit(rps = 100,  burst = 200),
        UserTier.PREMIUM  to RateLimit(rps = 1000, burst = 2000),
        UserTier.INTERNAL to RateLimit.UNLIMITED
    )
)
```

**적용 라우트**: order, payment, search 추가.

**메트릭**: 429 비율 / 라우트별 / tier별 → Grafana 대시보드.

### 2-3. Saga 분산 트레이싱

**현재**: order ↔ inventory ↔ payment 흐름이 Kafka 이벤트로 분산. 실패 시 추적 어려움.

**개선안**:
- OpenTelemetry trace_id를 Kafka 메시지 헤더에 propagate
- Jaeger / Tempo 도입
- Saga 단계별 메트릭: `saga.order.step.completed`, `saga.order.step.failed`
- 실패 시 보상 트랜잭션 자동 trigger + alert

**KPI**: SAGA P99 추적 시간 < 5초, 실패율 알림.

---

## 3. P1 — 6개월 내

### 3-1. Notification Service 신설

**왜**: 현재 결제 완료, 주문 상태, 재고 부족 알림이 산재. 채널 추상화 부재.

**설계**: 위 07번 문서 그대로 적용.
- Producer (order, payment, inventory) → Kafka `notif.requested`
- Router worker → 사용자 선호 / Quiet hours / Throttle / Dedup 4단계 필터
- Channel worker (push, email, sms, in-app)

**ADR 후보**: ADR-0028 (이미 chatbot용 ADR-0015 있으므로 별도)

### 3-2. Multi-PG 라우팅

**왜**: 단일 PG (Toss 가정) 장애 시 결제 전체 마비.

**설계**:
- PG abstraction (`PaymentProvider` interface)
- 운영 정책: 70% Toss, 20% KG이니시스, 10% NHN KCP
- CircuitBreaker per provider → open 시 traffic shift
- Reconciliation per provider (D+1 정산)

### 3-3. Stampede 방어

**현재**: Cache miss 시 다수 동시 요청이 DB로 폭주.

**개선**: Redis SETNX mutex + 백그라운드 갱신.

```kotlin
fun getProduct(id: Long): Product {
    val cached = redis.get("product:$id")
    if (cached != null) return cached.deserialize()

    val mutex = "lock:product:$id"
    return if (redis.setIfAbsent(mutex, "1", Duration.ofSeconds(10)) == true) {
        try {
            val fromDb = productRepo.findById(id)
            redis.set("product:$id", fromDb.serialize(), Duration.ofMinutes(5))
            fromDb
        } finally {
            redis.delete(mutex)
        }
    } else {
        Thread.sleep(50)
        getProduct(id)  // 다른 요청이 채워줄 때까지 대기
    }
}
```

---

## 4. P2 — 6-12개월

### 4-1. Snowflake / KSUID PK

**왜**: 모든 서비스가 단일 MySQL Auto-Increment. 1억 row 도달 시 샤딩 마이그레이션 강제.

**개선안**:
- `common` 에 `IdGenerator` 모듈 추가
- KSUID 27자 base62 (시간 정렬 + 분산 친화)
- 신규 테이블부터 적용, 기존은 점진 (dual-write)

```kotlin
// common
class KsuidGenerator {
    fun next(): String = Ksuid.newKsuid().toString()
}
```

**기존 PK 마이그레이션**: 별도 컬럼 추가 + dual-write → 모든 참조 변경 후 swap.

### 4-2. Service Mesh (Istio)

**왜**:
- mTLS (mutual TLS, 양방향 TLS)를 코드 밖으로
- 가시성 (Kiali, Jaeger 자동)
- Canary / Traffic split 코드 변경 없이

**고려사항**: K8s 운영 부담 증가, sidecar latency (1-2ms).

### 4-3. Multi-region Active-Passive

**왜**: 단일 region (예: 서울) 다운 시 service down.

**설계**:
- Primary: ap-northeast-2 (서울)
- Standby: ap-northeast-1 (도쿄)
- DB: Aurora Global Database (RPO (Recovery Point Objective, 복구 지점 목표) 1초, RTO (Recovery Time Objective, 복구 시간 목표) 1분)
- Kafka MirrorMaker → DR (Disaster Recovery, 재해 복구) cluster sync
- Route53 health check → 자동 failover

**Cost**: 인프라 ~1.5배.

---

## 5. P3 — 1년+

### 5-1. LTR (Learning to Rank) 검색

**현재**: function_score 가중치 합산. 정적 모델.

**개선**:
- TF-Ranking / LightGBM
- Feature: query, product, user (CTR, CVR, dwell time)
- Online A/B 테스트 (experiment 서비스 활용)

### 5-2. DLQ 일원화

**현재**: 각 서비스가 자체 DLQ (Dead Letter Queue, 데드 레터 큐). 대시보드 흩어짐.

**개선**:
- 공통 DLQ 토픽 (`dlq.{originTopic}.{consumerGroup}`)
- 운영 도구: replay, drop, requeue
- Slack alert 자동화

### 5-3. Outbox + Debezium 전 서비스

**현재**: inventory만 Outbox 적용 (ADR-0011).

**개선**: order, product, member 등 mutation 발생 서비스 모두 적용.

---

## 6. 시나리오별 매핑

각 개선이 어떤 시나리오에 도움 되는지:

| 개선 | URL | Chat | Feed | Pay | Rate | Notif | Tick | Search | Comm | Map |
|---|---|---|---|---|---|---|---|---|---|---|
| Idempotency | ✓ | | | ★★★ | | ✓ | ★★ | | ★★★ | |
| Rate Tier | ✓ | ✓ | | ✓ | ★★★ | ✓ | ★★ | ✓ | ✓ | ✓ |
| Saga 트레이싱 | | | | ★★★ | | | ★★ | | ★★★ | |
| Notification | | | ✓ | ✓ | | ★★★ | ✓ | | ★★ | |
| Multi-PG | | | | ★★★ | | | ✓ | | ★★ | |
| Stampede | ★ | | ✓ | | | | ✓ | ★★ | ★★ | ✓ |
| Snowflake | ✓ | ✓ | ✓ | ✓ | | | ✓ | | ★★★ | |
| Service Mesh | | ✓ | | ✓ | ✓ | | | ✓ | ★★ | |
| Multi-region | ✓ | ★ | | ★★ | | | | | ★★ | |
| LTR | | | ✓ | | | | | ★★★ | ✓ | |

---

## 7. ADR 작성 우선순위

다음 분기 작성 후보:

1. **ADR-0028: Idempotency Standard** (P0)
2. **ADR-0029: Tiered Rate Limiting** (P0)
3. **ADR-0030: Distributed Tracing for Saga** (P0)
4. **ADR-0031: Notification Service** (P1)
5. **ADR-0032: Multi-PG Strategy** (P1)
6. **ADR-0033: ID Generation (KSUID)** (P2)

---

## 8. 면접 답변 화법

### 8-1. "본 프로젝트의 한계는?"

> "본 msa는 학습/포트폴리오 목적이라 단일 region, 단일 PG, Auto-Increment PK 등 운영 환경과 차이가 있습니다. 다음 분기 우선순위로는 (1) Idempotency-Key 명시적 강제 + Aspect로 일관화, (2) Rate Limiter Tier 도입으로 사용자별 차등 제어, (3) Saga 분산 트레이싱으로 분산 트랜잭션 가시성을 확보할 계획입니다."

### 8-2. "DAU 100x 시?"

> "현재 단일 MySQL이 병목이 됩니다. 우선 KSUID PK로 채번을 분산 친화적으로 바꾸고, 서비스별 DB 물리 분리, 그 다음 read-heavy 서비스 (product, search) 부터 read replica 추가, 그래도 부족하면 user-id 기반 horizontal sharding을 단계적으로 도입하겠습니다."

### 8-3. "장애 대응은?"

> "현재는 단일 region이라 region 다운 시 서비스 정지가 한계입니다. Multi-region active-passive로 RPO 1초, RTO 1분 목표가 다음 단계이고, 그 전 단계로 Aurora Multi-AZ (Availability Zone, 가용 영역) + Kafka MirrorMaker 도입을 고려하고 있습니다."

---

## 9. 회고: 왜 이 개선들이 필요한가

| 개선 | 학습/포트폴리오에선 OK | 운영 환경에선 |
|---|---|---|
| 단일 PG | OK | ★★★ 위험 (장애 = 매출 0) |
| Auto-Increment PK | OK (1만 row) | 1억 row 폭사 |
| 단일 region | OK | SLA (Service Level Agreement, 서비스 수준 협약) 99.9% 못 맞춤 |
| 단일 limiter | OK | 사용자 불만, 차등 안 됨 |
| Notification 산재 | OK | 채널 추가 시 N×M 결합 |
| Saga 가시성 부족 | OK (작은 흐름) | 운영 디버깅 비용 폭증 |

**결론**: 본 프로젝트의 80%는 학습 목적으로 충분. 나머지 20%가 운영 가능 수준으로 가기 위한 갭.

---

## 10. 마무리 한 마디

> "시스템 설계는 정답이 아니라 trade-off의 연속. 본 msa는 Clean Architecture + Kafka + ES + K8s라는 표준 스택을 **올바르게 조립**한 사례. 다음 진화는 (1) **운영 신뢰성** (Idempotency, Multi-region), (2) **확장성** (Sharding, Service Mesh), (3) **인텔리전스** (LTR, Saga Orchestrator) 세 축으로 정리할 수 있다."
