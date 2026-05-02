# ADR-0030 Read-after-Write Stickiness (Replica Lag 보정)

## Status

Proposed

**Date**: 2026-05-02
**Authors**: kgd
**Related**: ADR-0006 (Database Strategy), ADR-0007 (Cache Strategy), ADR-0019 (K8s Migration), ADR-0020 (Transactional Usage; conventions/transactional-usage.md), ADR-0026 (Docs Taxonomy)

> 루트 `docs/adr/`에 두는 이유: 11개 JVM 서비스 전반의 Master/Replica 라우팅 시맨틱을 바꾸는 cross-cutting 결정이며, 이후 모든 신규 서비스가 동일한 routing 정책을 공유한다. 운영 SOP / 메트릭 / 알람 정책에도 ripple effect 가 발생한다 (ADR-0026 §2 ripple-effect 기준 부합).

---

## Context

### 1. 현재 구현 상태 — R/W routing 은 완료

msa 11개 JVM 서비스(`product`, `order`, `wishlist`, `inventory`, `fulfillment`, `warehouse`, `gifticon`, `member`, `code-dictionary`, `auth`, 그 외 1개)는 **이미** `AbstractRoutingDataSource + LazyConnectionDataSourceProxy + @Transactional(readOnly=true)` 의 3-컴포넌트 표준 패턴을 동일하게 적용하고 있다. 예시(`product/app/src/main/kotlin/com/kgd/product/config/DataSourceConfig.kt:15-50`):

```kotlin
enum class DataSourceType { MASTER, REPLICA }

class RoutingDataSource : org.springframework.jdbc.datasource.lookup.AbstractRoutingDataSource() {
    override fun determineCurrentLookupKey(): DataSourceType =
        if (TransactionSynchronizationManager.isCurrentTransactionReadOnly())
            DataSourceType.REPLICA else DataSourceType.MASTER
}

@Configuration
class DataSourceConfig {
    @Bean
    fun routingDataSource(
        @Qualifier("masterDataSource") master: DataSource,
        @Qualifier("replicaDataSource") replica: DataSource
    ): DataSource = RoutingDataSource().apply {
        setTargetDataSources(mapOf(
            DataSourceType.MASTER to master,
            DataSourceType.REPLICA to replica
        ))
        setDefaultTargetDataSource(master)
        afterPropertiesSet()
    }

    @Bean
    @Primary
    fun dataSource(@Qualifier("routingDataSource") routingDataSource: DataSource): DataSource =
        LazyConnectionDataSourceProxy(routingDataSource)
}
```

`order/app/src/main/kotlin/com/kgd/order/config/DataSourceConfig.kt:13-50` 도 패키지 외 동일. 즉 라우팅 파이프라인은 이미 준비되어 있고 **유일하게 빠진 piece** 는 read-after-write 일관성 보강(stickiness)이다.

### 2. 함정 — Replica Lag 으로 인한 read-after-write 비일관성

MySQL async replication 특성상 binlog → relay log → SQL apply 과정에서 lag 가 발생한다(`study/docs/15-connection-pool/10-replica-lag-consistency.md` §1):

- 정상: < 100 ms
- 높은 부하: 1 ~ 5 s
- DDL / large transaction: 수 분

같은 사용자가 write 직후 read 하는 시나리오는 현 구현에서 **반드시 깨진다**:

```
T0: client → POST /wishlist                 [readOnly=false → MASTER → INSERT commit]
T1: master 응답 200 OK
T2: replica 가 binlog 적용 전 (lag 50 ~ 500 ms)
T3: client → GET /wishlist?memberId=...     [readOnly=true → REPLICA SELECT]
T4: replica 에 row 가 아직 없음 → 빈 리스트 반환
```

UX: "방금 추가했는데 안 보여요". 학습 노트 grounding:

- `study/docs/4-db-index-transaction/16-msa-tx-routing.md:69-94` — wishlist add → 즉시 my-wishlist 조회 시 lag 기간 동안 못 봄
- `study/docs/5-spring-transactional/07-replica-routing-pattern.md:288-310` — "msa 는 현재 1번(stickiness) 도 2번(hint) 도 없음. 단순 fast-path cachePort 로 일부 흡수"
- `study/docs/15-connection-pool/10-replica-lag-consistency.md:62-83` — "내가 방금 등록한 게 안 보여요" 의 진짜 원인

이 ADR 은 위 갭 하나를 막는다.

### 3. 3주제 cross-reference

학습 노트에서 **세 주제가 독립적으로 같은 결론** 에 도달했다:

| 주제 | 출처 | 한 줄 요약 |
|---|---|---|
| #4 DB Index/Transaction | `study/docs/4-db-index-transaction/16-msa-tx-routing.md:88-95` | replica lag 동안 read-after-write 깨짐 → stickiness / wait / Outbox 패턴 검토 필요 |
| #5 Spring Transactional | `study/docs/5-spring-transactional/13-improvements.md:62-117` | "Read-After-Write Stickiness ADR (신규)" — 우선순위 TOP 3 중 하나 |
| #15 Connection Pool | `study/docs/15-connection-pool/17-improvements.md:297-389` | P2-8 read-after-write stickiness — common 으로 추출, Redis 마커 + RoutingDataSource 확장 |

세 주제가 같은 결정에 수렴하므로 본 ADR 로 정책을 확정한다.

### 4. 기존 우회책 한계

현재는 다음 우회로 일부 케이스만 흡수한다(완전한 해결책 아님):

- **응답 body 에 데이터 포함**: write 응답에 created entity 를 포함시켜 클라이언트가 다시 GET 하지 않게. 단, "list 화면으로 이동" 같은 다음 페이지에선 무력함.
- **Redis cache fast-path**: 일부 서비스(`product`)의 cachePort 가 우연히 흡수. 단, 캐시 hit 보장 없음 + cache eviction 정책과 충돌.
- **단순 조회에 `@Transactional` 미부착**: ADR-0020 (현 `docs/conventions/transactional-usage.md`) 의 "단순 조회에 readOnly 도 권장 안 함" 규칙과 결합되면 우연히 MASTER 로 라우팅. 단, 모든 서비스/메서드에 일관 적용 안 됨 + 큰 조회의 풀 효율 저하.

→ 정책 일관성 + 의도 명시성 둘 다 부족.

---

## Decision

### 1. 메커니즘: Request-scoped Sticky Marker (Redis 기반) + 명시적 `@UseMaster` 보조

두 layer 의 결합을 채택한다:

1. **자동 layer (default)** — write 트랜잭션 commit 직후 user key 를 Redis 에 짧은 TTL(2s) 로 mark. 같은 user 의 후속 readOnly 트랜잭션은 mark 가 남아있는 동안 `MASTER` 로 라우팅.
2. **명시적 layer (escape hatch)** — `@UseMaster` annotation 으로 특정 메서드를 `MASTER` 강제. AOP advice 가 ThreadLocal 플래그 set, `RoutingDataSource` 가 우선 참조. 결제 직후 즉시 조회 / 정산 완료 직후 화면 노출 등 hard-case 용.

GTID-wait(MySQL `WAIT_FOR_EXECUTED_GTID_SET`) 는 **거부** — 강한 일관성 비용이 latency P99 에 직접 가산되고, msa 의 사용자 자기 데이터 일관성에 필요한 수준은 stickiness 로 충분하다(아래 Alternatives §C).

### 2. 컴포넌트 위치 — `common` 모듈로 통합

기존 11 서비스의 중복 `DataSourceConfig.kt` 를 `common` 으로 추출하면서 stickiness 도 함께 들어간다(P1-5 와 묶음, `study/docs/15-connection-pool/17-improvements.md:162-225`). 신규 파일 트리:

```
common/src/main/kotlin/com/kgd/common/datasource/
├── DataSourceType.kt                       # enum { MASTER, REPLICA }
├── RoutingDataSource.kt                    # AbstractRoutingDataSource 확장
├── RoutingContext.kt                       # ThreadLocal — @UseMaster / 명시 강제
├── UseMaster.kt                            # @UseMaster annotation + AOP advice
├── WriteStickinessTracker.kt               # Redis 마커 set / get
├── StickinessKeyResolver.kt                # user key 추출 (SecurityContext / header 등)
├── WriteEvent.kt                           # afterCommit 발행 이벤트
├── WriteStickinessEventListener.kt         # @TransactionalEventListener(AFTER_COMMIT)
└── CommonDataSourceAutoConfiguration.kt    # 자동 등록
```

`META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` 에 `CommonDataSourceAutoConfiguration` 등록(`docs/architecture/common-features.md` 의 auto-configuration 컨벤션 준수).

### 3. RoutingDataSource 결정 로직

```kotlin
class RoutingDataSource(
    private val tracker: WriteStickinessTracker,
    private val keyResolver: StickinessKeyResolver,
) : AbstractRoutingDataSource() {

    override fun determineCurrentLookupKey(): DataSourceType {
        // (1) 명시적 강제 — @UseMaster 또는 RoutingContext.forceMaster()
        if (RoutingContext.isUseMaster()) return DataSourceType.MASTER

        // (2) 자동 stickiness — 같은 user 가 최근 N 초 내 write 했으면 MASTER
        val key = keyResolver.currentKey()
        if (key != null && tracker.isRecentWrite(key)) {
            return DataSourceType.MASTER
        }

        // (3) 기본 — readOnly 트랜잭션 → REPLICA, else MASTER
        return if (TransactionSynchronizationManager.isCurrentTransactionReadOnly())
            DataSourceType.REPLICA else DataSourceType.MASTER
    }
}
```

**중요한 보강**: 본 결정은 `LazyConnectionDataSourceProxy` 를 그대로 유지함을 전제로 한다. `LazyConnection` 이 빠지면 트랜잭션 begin 시점에 `isCurrentTransactionReadOnly()` 가 아직 ThreadLocal 에 들어가지 않아 항상 MASTER 로 라우팅되는 알려진 함정이 있다(`study/docs/15-connection-pool/09-reader-writer-routing.md:160-222`). stickiness 추가 후에도 이 invariant 는 유지된다.

### 4. 마킹 위치 — `@TransactionalEventListener(AFTER_COMMIT)`

```kotlin
data class WriteEvent(val key: String)

@Component
class WriteStickinessEventListener(private val tracker: WriteStickinessTracker) {

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    fun onWriteCommit(event: WriteEvent) {
        tracker.markRecentWrite(event.key)
    }
}
```

Service 레이어에서 write 완료 직전(같은 트랜잭션 내)에 `applicationEventPublisher.publishEvent(WriteEvent(memberId))` 호출. AFTER_COMMIT phase 가 commit 성공 후 실행되므로 rollback 시 mark 안 함(false positive 차단).

**boilerplate 최소화 옵션 (Phase 2)**: `@WriteStickyAware(keyExpr = "#memberId")` 같은 메타 annotation + AOP advice 로 명시적 publish 호출을 제거할 수 있다. 단, Phase 1 은 명시적 publish 로 시작(가시성 우선).

### 5. WriteStickinessTracker 구현

```kotlin
@Component
class WriteStickinessTracker(
    private val redis: StringRedisTemplate,
    @Value("\${kgd.common.datasource.stickiness.ttl-ms:2000}") private val ttlMs: Long,
    @Value("\${kgd.common.datasource.stickiness.key-prefix:rw_sticky}") private val prefix: String,
) {
    private val log = KotlinLogging.logger {}

    fun markRecentWrite(key: String) {
        runCatching {
            redis.opsForValue().set(redisKey(key), "1", Duration.ofMillis(ttlMs))
        }.onFailure { ex ->
            // Redis 장애 시 silent — 정합성 안 깨지고 일관성만 약화
            log.warn(ex) { "stickiness mark failed key=$key" }
        }
    }

    fun isRecentWrite(key: String): Boolean =
        runCatching { redis.hasKey(redisKey(key)) }.getOrElse {
            // Redis 장애 → false 반환 (graceful degrade — 정합성 영향 없음)
            false
        }

    private fun redisKey(k: String) = "$prefix:$k"
}
```

핵심:

- TTL 2000ms 가 default (운영 lag 측정값으로 분기마다 갱신, `docs/conventions/` 부록 권장).
- Redis 장애 시 **silent degrade**. mark 실패 → 후속 read 가 replica 로 가서 `not-found` 가 잠깐 보일 수 있음. 정합성은 깨지지 않고 일관성만 약화. 기존 동작과 동치이므로 추가 risk 없음.
- 키 prefix 는 멀티 서비스에서 충돌 회피용. 같은 Redis 클러스터 공유 시에도 namespace 분리.

### 6. StickinessKeyResolver — user key 추출

```kotlin
interface StickinessKeyResolver {
    fun currentKey(): String?
}

@Component
@ConditionalOnMissingBean(StickinessKeyResolver::class)
class DefaultStickinessKeyResolver : StickinessKeyResolver {
    override fun currentKey(): String? {
        // Gateway 가 X-Member-Id / X-User-Id 헤더로 인증 정보를 downstream 에 주입 (ADR-0004 패턴)
        val attrs = RequestContextHolder.getRequestAttributes() as? ServletRequestAttributes
            ?: return null
        return attrs.request.getHeader("X-Member-Id")
            ?: SecurityContextHolder.getContext().authentication?.name
    }
}
```

서비스 별 override 가능(coroutine 환경 / Webflux gateway 등). 익명 사용자(key == null) 는 stickiness 적용 대상 아님 — 어차피 "내 데이터" 가 없으므로 read-after-write 문제도 없다.

### 7. @UseMaster annotation — 명시적 escape hatch

```kotlin
@Target(AnnotationTarget.FUNCTION)
@Retention(AnnotationRetention.RUNTIME)
annotation class UseMaster

object RoutingContext {
    private val tl = ThreadLocal.withInitial { false }
    fun isUseMaster(): Boolean = tl.get()
    fun setUseMaster(v: Boolean) = tl.set(v)
    fun clear() = tl.remove()
}

@Aspect
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
class UseMasterAspect {
    @Around("@annotation(com.kgd.common.datasource.UseMaster)")
    fun around(pjp: ProceedingJoinPoint): Any? {
        val prev = RoutingContext.isUseMaster()
        RoutingContext.setUseMaster(true)
        return try {
            pjp.proceed()
        } finally {
            if (!prev) RoutingContext.clear() else RoutingContext.setUseMaster(prev)
        }
    }
}
```

사용처(권장):

- 결제 직후 주문 상세 조회
- 자기 정산 완료 직후 잔액 조회
- 회원가입 직후 프로필 첫 조회 (회원가입 PR 흐름)

### 8. application.yml 표준

각 서비스의 `application.yml` (또는 `kubernetes` profile) 에 추가:

```yaml
kgd:
  common:
    datasource:
      routing-enabled: true        # CommonDataSourceAutoConfiguration 활성
      stickiness:
        enabled: true              # WriteStickinessTracker 활성 (false 면 step 2 skip)
        ttl-ms: 2000               # mark TTL — replica lag p99 기준 결정
        key-prefix: rw_sticky      # Redis namespace
```

`stickiness.enabled=false` 로 두면 회귀 케이스에서 step 2 만 끄고 step 1 (`@UseMaster`) + step 3 (readOnly routing) 은 유지 — 안전한 kill switch.

### 9. 영향 코드 / 문서 (요약)

- `common/src/main/kotlin/com/kgd/common/datasource/` — 신규 파일 8개 (위 §2 트리)
- `common/src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` — 등록
- `*/app/.../config/DataSourceConfig.kt` — **삭제** (common 으로 흡수, P1-5 와 묶음)
- `*/app/src/main/resources/application.yml` — `kgd.common.datasource.*` 추가
- `wishlist`, `order`, `member`, `gifticon` 등 write Service — `applicationEventPublisher.publishEvent(WriteEvent(memberId))` 추가
- `docs/conventions/code-convention.md` — TransactionalService 분리 패턴에 "write commit 후 WriteEvent 발행" 항목 추가
- `docs/conventions/transactional-usage.md` — `@UseMaster` 사용 가이드 + 안티패턴 추가
- `docs/architecture/common-features.md` — `kgd.common.datasource.*` 항목 추가

---

## Consequences

### Positive

- **사용자 자기 데이터 read-after-write 일관성 보장** — UX 측 "방금 추가한 게 안 보여요" 사고 0 으로 수렴(lag < TTL 인 한).
- **명시적 `@UseMaster` 로 hard-case 커버** — 결제/주문 같은 강한 일관성 케이스에 declarative 패턴.
- **정책의 단일 진입점** — 라우팅 결정 로직이 `common.datasource.RoutingDataSource` 한 곳. 11개 중복 제거(P1-5 시너지).
- **Auto-configuration 조건부 활성** — 기존 R/W 분리 안 한 신규 서비스에는 영향 0(`routing-enabled=false`).
- **Kill switch** — `stickiness.enabled=false` 로 자동 layer 만 즉시 비활성. 회귀 시 분 단위 롤백.
- **세 주제 cross-cutting 결정의 정합** — #4 / #5 / #15 의 후속 ADR 후보들이 본 ADR 로 통일.

### Negative

- **Redis 의존 추가** — 라우팅이 외부 인프라에 의존하게 됨. 단, Redis 장애 시 silent degrade (기존 동작과 동치) 라 정합성 영향 0.
- **Master 부하 증가** — 추정 5 ~ 10% (write 한 user 의 후속 read 2s 분량). 운영 모니터링으로 검증 후 TTL 조정.
- **Boilerplate** — write Service 마다 `WriteEvent` publish 추가. Phase 2 에 `@WriteStickyAware` annotation 으로 제거 가능.
- **익명 사용자 미커버** — 익명 write 시나리오는 본 메커니즘으로 보장 불가. 단, 거의 없음(authn 강제) — gifticon 공유 링크 클릭 같은 케이스만 검토 필요.
- **여러 사용자가 같은 row 를 보는 경우 미커버** — admin 백오피스에서 다른 user 의 write 결과를 즉시 보는 시나리오는 stickiness 로 안 됨. `@UseMaster` 로 명시 처리.
- **TTL 튜닝 필요** — replica lag 가 TTL 보다 길면 효과 없음. 운영 lag p99 < TTL 을 만족시키는 모니터링 알람 필요.
- **트랜잭션 중간 라우팅 변경 불가는 그대로** — 하나의 readOnly 트랜잭션 안에서 도중에 stickiness 가 만료돼도 이미 결정된 데이터소스 유지(LazyConnection 의 invariant). 정상 동작.

### 운영 부담

- **Redis 가용성** — kgd common Redis (standalone, ADR-0007) 의존. SLA 목표 99.9% (월 43분 다운타임 허용) 면 라우팅 silent degrade 영향 무시 가능.
- **메트릭 추가**:
  - `routing_decisions_total{reason="readonly|sticky|usemaster|default", target="master|replica"}` — 실제 라우팅 분포 측정
  - `stickiness_mark_failures_total` — Redis write 실패 카운터 (alarm warning)
  - `replica_lag_seconds` (mysqld_exporter) — TTL 산정 근거. 알람: `replica_lag_seconds > stickiness.ttl-ms / 1000` 발화 시 TTL 재산정
- **롤아웃 모니터링**:
  - 단계별 master 풀 active connection 추이
  - "내 데이터 안 보임" 류 5xx / 4xx 추이 (있다면) — stickiness 후 감소 확인
  - sticky window 내 read 비율 (=`reason="sticky"` / total) — TTL 적정성 판단

---

## Alternatives Considered

### A. 글로벌 read-after-write 비활성 (replica 라우팅 자체 끄기)

- **거부 이유**: master 부하 5 ~ 10% 가 아니라 100% 가 master 로 회귀. R/W 분리 도입 효과 자체를 폐기. 일부 대형 read query (보고서, 검색) 가 master OLTP 와 자원 경쟁하는 옛 문제 재발.

### B. Replica lag 모니터링 + 알람만 (정책 변경 없음)

- **거부 이유**: lag 알람은 "이미 사용자에게 영향이 발생한 후" 의 사후 신호. UX 사고를 사전 차단하지 못함. 모니터링은 본 ADR 의 운영 부담 항목으로 흡수되고, 별도 정책 없이는 의미 없음.

### C. GTID Wait (`WAIT_FOR_EXECUTED_GTID_SET`) — 강한 일관성

- **메커니즘**:
  ```sql
  -- master commit 후 GTID 획득 → cookie / header 로 전파 → replica 가 그 GTID 까지 기다린 뒤 read
  SELECT @@global.gtid_executed;                                  -- master, write 후
  SELECT WAIT_FOR_EXECUTED_GTID_SET('uuid:1-12345', 5);          -- replica, read 전
  ```
- **거부 이유**:
  - **Latency P99 직접 가산** — 매 read 마다 wait, lag spike 시 wait 5s 까지 → ADR-0025 Tier 1 SLA 위반.
  - **MySQL 의존성 강화** — Aurora / Vitess / 향후 다른 storage 마이그레이션 시 호환 깨짐.
  - **GTID propagation 인프라** — write 응답에 GTID, 클라이언트가 next read 에 동봉, gateway 에서 routing — 변경 범위 큼.
  - **사용자 자기 데이터 일관성에는 과대 처방** — stickiness 의 ms 단위 trade 가 본 도메인에 적합. 결제/정산 같은 글로벌 강한 일관성 케이스는 `@UseMaster` 로 충분.
  - **defer**: 향후 admin 백오피스 / 정산 보고서가 cross-user 강한 일관성을 요구하면 별도 ADR 로 도입 검토.

### D. 모든 read 를 master 로 (단순 우회)

- **거부 이유**: alternative A 와 동일.

### E. `@WithMaster` annotation 만 (자동 layer 없이 명시적)

- **거부 이유**: write endpoint 마다 후속 read endpoint 를 식별 + annotation 부착해야 → **누락 위험 큼**. 신규 endpoint 추가 시 항상 review 강제 필요. 자동 layer 가 default 안전망 역할.

### F. ProxySQL / RDS Proxy / Aurora 자동 라우팅

- **거부 이유 (현 시점)**:
  - msa 가 application 레벨 라우팅 (ADR-0019 기조 — 인프라 단순) 채택
  - ProxySQL 도입은 별도 ADR (P2-9, `study/docs/15-connection-pool/17-improvements.md:393-422`)
  - Aurora 는 본 플랫폼의 storage 선택과 분리된 결정
- **defer**: 향후 ProxySQL / Aurora 도입 시 본 ADR 의 application-level stickiness 는 "L2 fallback" 으로 전환 가능 (인프라 라우팅이 우선, 그 위에 application sticky 가 catch-up).

### G. Caching / Read-your-own-write — 클라이언트 측 "방금 쓴 거" cache

- **거부 이유**:
  - 응답 body 의 entity 만 보는 단일 페이지에선 부분 효과. list / 다음 페이지로 이동 시 무력.
  - 다중 디바이스(데스크톱 write → 모바일 read) 시나리오 미커버.
  - 본 ADR 의 보완책으로 병행 가능 (서로 conflict 없음).

---

## Rollout Plan

### Phase 0 — 코드 기반 마련 (1주)

- [ ] common 신규 파일 8개 작성 + 단위 테스트
- [ ] `CommonDataSourceAutoConfiguration` 등록
- [ ] `WriteStickinessTracker` 가 redis stub 으로 동작 검증
- [ ] `RoutingDataSource` 의 결정 분기를 BehaviorSpec 으로 케이스 표 7가지 검증:
  - `(readOnly=true, sticky=false, useMaster=false)` → REPLICA
  - `(readOnly=false, sticky=*, useMaster=*)` → MASTER
  - `(readOnly=true, sticky=true, useMaster=false)` → MASTER
  - `(readOnly=true, sticky=false, useMaster=true)` → MASTER
  - `(readOnly=true, sticky=true, useMaster=true)` → MASTER
  - `(key=null, ...)` → step 2 skip
  - `(redis 장애, ...)` → step 2 false 반환 → REPLICA
- 본 phase 결과: common 만 변경, 11 서비스 영향 0.

### Phase 1 — `wishlist` 서비스 시범 적용 (1주)

- [ ] `wishlist/app/src/main/kotlin/com/kgd/wishlist/config/DataSourceConfig.kt` 삭제 → common 사용
- [ ] `wishlist` write Service 에 `WriteEvent` publish 추가
- [ ] application.yml 에 `kgd.common.datasource.*` 추가
- [ ] 메트릭 wiring 검증 (`routing_decisions_total` 분포 확인)
- **선정 이유**: 도메인 단순(member-scoped CRUD), 트래픽 낮음, "추가 직후 리스트 진입" 시나리오가 정확히 read-after-write 함정의 교과서 케이스.
- **롤백 기준**: master 풀 active connection 평균이 baseline 대비 +30% 이상 / sticky decision 비율 50% 초과 / 라우팅 결정 latency p99 +5ms 이상 — 셋 중 하나면 즉시 `stickiness.enabled=false`.

### Phase 2 — Tier 1 critical 서비스 적용 (1주)

리스크 → 영향 순으로 순서 결정:

1. **`order`** — write 후 즉시 GET /orders/{id} 가 결제 confirm 페이지에서 빈번. UX critical.
2. **`product`** — 등록 직후 어드민 화면 / SSOT 영향 (Search 인덱싱은 별 경로라 무관).
3. **`member`** — 회원가입 직후 프로필 조회.

각 서비스는 `wishlist` Phase 1 의 메트릭 baseline 확인 후 단계 적용. 결제 confirm 흐름은 `@UseMaster` 도 같이 부착.

### Phase 3 — 나머지 서비스 + 정리 (1주)

- 나머지 7 ~ 8개 서비스 일괄 적용
- 11개 서비스의 중복 `DataSourceConfig.kt` 전체 삭제
- `docs/conventions/transactional-usage.md` 갱신
- `docs/architecture/common-features.md` 항목 추가
- ADR-0030 status: `Proposed → Accepted`

### 위험도 순서 — order/payment > 일반 read

- 결제 흐름의 confirm read 는 `@UseMaster` 가 default 라인. 자동 stickiness 가 flake 해도 결제는 영향 0.
- 일반 read (마이페이지, 위시리스트) 는 자동 stickiness 만으로 충분.
- 보고서 / 정산 / admin cross-user 조회는 본 ADR 범위 외 — 향후 GTID wait 또는 명시적 master read repository 패턴(별도 ADR).

---

## Cross-references

- ADR-0006 Database Strategy — master/replica 분리 정책 (본 ADR 의 전제)
- ADR-0007 Cache Strategy — Redis 의존성 결정. 본 ADR 의 stickiness tracker 가 동일 Redis 인프라 활용
- ADR-0019 K8s Migration — Eureka 제거 / k3s-lite + prod-k8s overlay 이원화. CommonDataSourceAutoConfiguration 은 둘 다에서 동작
- ADR-0020 (현 `docs/conventions/transactional-usage.md`) — `@Transactional` 사용 규칙. 본 ADR 의 `@UseMaster` 가 클래스 레벨 트랜잭션 함정과 함께 conventions 보강 대상
- ADR-0026 Docs Taxonomy — 본 ADR 이 ripple-effect cross-cutting 정책이라 ADR 카테고리. 운영 SOP / 메트릭 부록은 향후 `docs/conventions/datasource-routing.md` 로 분해 가능
- 학습 노트 (배경):
  - `study/docs/4-db-index-transaction/16-msa-tx-routing.md` (TX × 격리 × Routing 결합)
  - `study/docs/5-spring-transactional/06-readonly-vs-writable.md` (readOnly 의 4중 효과)
  - `study/docs/5-spring-transactional/07-replica-routing-pattern.md` (현 11 서비스 패턴)
  - `study/docs/5-spring-transactional/13-improvements.md` (#5 주제 ADR 후보)
  - `study/docs/15-connection-pool/09-reader-writer-routing.md` (3-컴포넌트 표준)
  - `study/docs/15-connection-pool/10-replica-lag-consistency.md` (lag 시나리오 + 처치 패턴)
  - `study/docs/15-connection-pool/17-improvements.md` (#15 주제 ADR 후보 P2-8)
  - `study/docs/00-ADR-CANDIDATES.md` §1418 "ADR-0029 Read-after-Write Stickiness — 3개 주제 통합"

---

## Open Questions

- [ ] TTL default 2000ms 의 production 측정 — replica lag p99 < 2s 가 평소 만족되는지 phase 0 모니터링 필요
- [ ] Coroutine 환경(`quant`) 의 ThreadLocal 전파 — `MDCContext` 류 명시 필요. 본 ADR 은 일단 JVM 11 서비스 대상, quant 은 별도 검토(`@UseMaster` AOP 가 coroutine 경계 넘는지 검증)
- [ ] `gateway` (Reactive Webflux) 의 stickiness 전파 — gateway 는 R/W routing 미적용이라 본 ADR 영향 없음. 단, downstream 호출 시 user header 전파(`X-Member-Id`) 는 ADR-0004 패턴으로 이미 보장
- [ ] `@WriteStickyAware(keyExpr = "#memberId")` AOP 자동화 — Phase 2 후 boilerplate 측정값으로 결정
- [ ] cross-service stickiness — `wishlist` 가 자기 DB 에 write 한 직후 `member` 서비스가 read 하는 분산 read-after-write 는 본 ADR 범위 외. eventual consistency 수용(Saga / Outbox) — `study/docs/00-ADR-CANDIDATES.md` 의 분산 시스템 ADR 군에서 별도 처리
