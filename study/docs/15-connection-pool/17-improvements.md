---
parent: 15-connection-pool
seq: 17
title: msa 풀 설정 개선 후보 + R/W 분리 ADR 초안
type: deep
created: 2026-05-01
---

# 17. msa 풀 설정 개선 후보

[15-codebase-audit.md](15-codebase-audit.md) 의 점검 결과를 기반으로 *우선순위* 와 *적용 방법* 을 정리. 각 항목은 ADR 후보 또는 단순 PR 후보.

---

## 개선 항목 11개

| # | 항목 | 우선순위 | 리스크 | 형태 |
|---|---|---|---|---|
| 1 | 11개 서비스에 leak-detection-threshold 추가 | P0 | L0 | PR (config only) |
| 2 | 11개 서비스에 connection-timeout 5s 추가 | P0 | L1 | PR (실 timeout 검증 필요) |
| 3 | pool-name 명시 (master/replica 분리 메트릭) | P1 | L0 | PR |
| 4 | keepalive-time 30s 추가 | P1 | L0 | PR |
| 5 | DataSourceConfig.kt common 으로 추출 | P1 | L2 | ADR + 점진 적용 |
| 6 | Lettuce Micrometer metrics 활성 | P1 | L0 | common 수정 |
| 7 | order 서비스 트랜잭션 외부 IO 분리 검증 | P1 | L1 | 코드 리뷰 |
| 8 | read-after-write stickiness 도입 | P2 | L2 | ADR + Redis 의존 |
| 9 | DB max_connections 검증 + ProxySQL 검토 | P2 | L3 | ADR |
| 10 | HPA maxReplicas cap 정책 (DB 한계 역산) | P2 | L2 | ADR |
| 11 | Lettuce disconnectedBehavior 설정 | P3 | L1 | common 수정 |

P0 = 즉시 / P1 = 1주 내 / P2 = 1달 내 / P3 = 백로그.

---

## P0-1: leak-detection-threshold 추가

### 변경

11개 서비스의 application.yml 에 추가:

```yaml
spring:
  datasource:
    master:
      hikari:
        maximum-pool-size: 10
        minimum-idle: 2
        leak-detection-threshold: 10000     # 10s
    replica:
      hikari:
        maximum-pool-size: 10
        minimum-idle: 2
        leak-detection-threshold: 10000
```

### 영향

- 비용: Exception 객체 + ScheduledFuture 한 개 — < 1µs
- 효과: leak 발생 시 stack trace 로 원인 코드 즉시 추적
- 운영 환경에서 *유일한* leak 추적 도구

### 검증

```bash
# 의도적 leak 코드 작성 후 로그 확인
grep "Apparent connection leak" application.log
```

---

## P0-2: connection-timeout 5s 추가

### 배경

현재 default 30s. gateway 의 routing timeout 보다 길어 thread leak 위험.

### 변경

```yaml
spring:
  datasource:
    master:
      hikari:
        connection-timeout: 5000
    replica:
      hikari:
        connection-timeout: 5000
```

### 영향

- 사용자 영향: 풀 압박 시 5s 후 fail-fast (이전 30s 대비 25s 단축)
- thread 회수 빠름 → cascade failure 회피
- 단, 정상 워크로드에서 borrow 가 5s 이상 걸리면 fail — 모니터링 후 조정

### 검증

```promql
# timeout 발생 추이
rate(hikaricp_connections_timeout_total[1h])
```

---

## P1-3: pool-name 명시

### 변경

```yaml
spring:
  datasource:
    master:
      hikari:
        pool-name: order-master-pool
    replica:
      hikari:
        pool-name: order-replica-pool
```

각 서비스마다 service명 적용.

### 효과

```promql
# 변경 전 — 구분 안 됨
hikaricp_connections_active{pool="HikariPool-1"} 5
hikaricp_connections_active{pool="HikariPool-2"} 3

# 변경 후
hikaricp_connections_active{pool="order-master-pool"} 5
hikaricp_connections_active{pool="order-replica-pool"} 3
```

알람 룰에서 master/replica 별 임계 다르게 설정 가능.

---

## P1-4: keepalive-time 30s 추가

### 배경

K8s Service / kube-proxy 가 idle TCP 를 일정 시간 후 정리. HPA scale-down 시 잔여 connection 이 stale 될 수 있음.

### 변경

```yaml
spring:
  datasource:
    master:
      hikari:
        keepalive-time: 30000      # 30s
```

### 효과

- 30초마다 idle connection 에 isValid() 핑
- silent drop 검출 시 softEvict
- 첫 트래픽 fail 회피

---

## P1-5: DataSourceConfig 의 common 추출 (ADR)

### 현황

11개 서비스가 DataSourceConfig.kt (`product/app/src/main/kotlin/com/kgd/product/config/DataSourceConfig.kt`) 와 *동일한* 코드 보유.

### 제안

`common` 에 `CommonDataSourceAutoConfiguration` 추가:

```kotlin
// common/src/main/kotlin/com/kgd/common/datasource/CommonDataSourceAutoConfiguration.kt
@AutoConfiguration
@ConditionalOnProperty(prefix = "kgd.common.datasource", name = ["routing-enabled"], havingValue = "true")
@ConditionalOnProperty(prefix = "spring.datasource.master", name = ["jdbc-url"])
@ConditionalOnProperty(prefix = "spring.datasource.replica", name = ["jdbc-url"])
class CommonDataSourceAutoConfiguration {
    
    @Bean
    @ConfigurationProperties(prefix = "spring.datasource.master")
    fun masterDataSource(): DataSource = DataSourceBuilder.create().build()
    
    @Bean
    @ConfigurationProperties(prefix = "spring.datasource.replica")
    fun replicaDataSource(): DataSource = DataSourceBuilder.create().build()
    
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

각 서비스의 application.yml:

```yaml
kgd:
  common:
    datasource:
      routing-enabled: true
```

### 효과

- 11개 DataSourceConfig.kt 삭제
- 향후 stickiness / 추가 라우팅 정책을 *한 곳* 에서 관리

### 리스크 (L2)

- 모든 서비스가 common 의존 — 변경 시 전체 영향
- 점진 적용 권장: 1개 서비스 적용 → 1주 운영 → 나머지 적용

---

## P1-6: Lettuce Micrometer 활성

### 변경

`common/src/main/kotlin/com/kgd/common/redis/CommonRedisAutoConfiguration.kt` 에 ClientResources 추가:

```kotlin
@Bean
@ConditionalOnMissingBean
fun lettuceClientResources(meterRegistry: MeterRegistry): ClientResources =
    DefaultClientResources.builder()
        .commandLatencyRecorder(
            MicrometerCommandLatencyRecorder(meterRegistry, MicrometerOptions.create())
        )
        .build()

@Bean
fun lettuceConnectionFactory(
    clusterConfiguration: RedisClusterConfiguration,
    clientResources: ClientResources
): LettuceConnectionFactory {
    val lettuceClientConfig = LettuceClientConfiguration.builder()
        .clientResources(clientResources)        // ← 주입
        .clientOptions(...)
        .commandTimeout(Duration.ofSeconds(2))
        .build()
    return LettuceConnectionFactory(clusterConfiguration, lettuceClientConfig)
}
```

### 효과

```
lettuce_command_completion_count{command="GET"}  ← 명령별 카운트
lettuce_command_completion_seconds{quantile="0.99"}  ← latency
```

Prometheus 알람 가능:

```yaml
- alert: RedisCommandLatencyHigh
  expr: |
    histogram_quantile(0.99, 
      rate(lettuce_command_completion_seconds_bucket[5m])) > 0.05
```

---

## P1-7: order 서비스 트랜잭션 외부 IO 검증

### 점검

```bash
grep -A 20 "@Transactional" order/app/src/main/kotlin/com/kgd/order/order/service/*.kt \
  | grep -E "WebClient|webClient|kafka|kafkaTemplate|s3"
```

ADR-0020 (`docs/adr/ADR-0020-transactional-usage.md`) 에서 외부 IO 분리 권장. *TransactionalService 분리 패턴* 이 적용되어 있는지 확인:

- `OrderTransactionalService` — `@Transactional` 만 담당
- `OrderService` — orchestration, 외부 IO

### 만약 미적용이면

리팩터링 → 트랜잭션 내 connection 점유 시간 50ms 이하 유지.

---

## P2-8: read-after-write stickiness (ADR)

### 제안

[10-replica-lag-consistency.md](10-replica-lag-consistency.md) 의 stickiness 패턴을 common 에 추가.

```kotlin
// common/src/main/kotlin/com/kgd/common/datasource/Stickiness.kt
@Component
class WriteStickinessTracker(private val redis: StringRedisTemplate) {
    
    fun markRecentWrite(key: String, ttl: Duration = Duration.ofSeconds(2)) {
        redis.opsForValue().set("write_stickiness:$key", "1", ttl)
    }
    
    fun isRecentWrite(key: String): Boolean =
        redis.hasKey("write_stickiness:$key")
}

// RoutingDataSource 수정
class RoutingDataSource(
    private val tracker: WriteStickinessTracker
) : AbstractRoutingDataSource() {
    
    override fun determineCurrentLookupKey(): DataSourceType {
        // 1. 명시적 master 강제
        if (RoutingContext.isUseMaster()) return DataSourceType.MASTER
        
        // 2. 사용자 stickiness
        val userId = SecurityContextHolder.getContext().authentication?.name
        if (userId != null && tracker.isRecentWrite(userId)) {
            return DataSourceType.MASTER
        }
        
        // 3. 트랜잭션 readOnly
        return if (TransactionSynchronizationManager.isCurrentTransactionReadOnly())
            DataSourceType.REPLICA else DataSourceType.MASTER
    }
}
```

`@Transactional` afterCommit 에서 mark:

```kotlin
@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
fun onWriteCommit(event: WriteEvent) {
    tracker.markRecentWrite(event.userId)
}
```

### 리스크 (L2)

- Redis 의존 추가 — Redis 장애 시 stickiness 미동작 (silent — 정합성 안 깨짐, 단지 일관성 약화)
- 모든 write 가 자기 user 에 대해 mark 해야 — 누락 시 효과 없음
- 효과 측정 어려움

### ADR 초안

```markdown
# ADR-XXXX: Read-after-write Stickiness via Redis

## Status
Proposed (2026-05-XX)

## Context

11개 서비스가 master/replica 분리되어 있으나 replica lag 으로 
"방금 등록한 게 안 보인다" 케이스 발생 가능. UX 문제.

## Decision

WriteStickinessTracker 컴포넌트를 common 에 추가. write 시 
afterCommit 에서 user key 를 Redis 에 2s TTL 로 mark. 
RoutingDataSource 가 이 mark 를 보고 master 로 라우팅.

## Consequences

(+) 사용자 자기 데이터 일관성 보장
(+) 명시적 @UseMaster annotation 도 함께 제공
(-) Redis 의존 추가
(-) master 부하 약간 증가 (예상 5~10%)

## Alternatives

- GTID wait — 강한 일관성, 복잡도 ↑
- 응답에 데이터 포함 — 일부 케이스만 cover

## Adoption Plan

1. common 에 코드 추가
2. product 서비스 1주 시범
3. 메트릭 확인 후 11개 전체 적용
```

---

## P2-9: DB max_connections 검증 (ADR)

### 점검

prod 환경의 RDS instance class 확인:

```bash
aws rds describe-db-instances --db-instance-identifier prod-mysql-master \
  --query 'DBInstances[0].DBInstanceClass'
```

산정:

```
인스턴스 수 (HPA peak) × 풀 사이즈 ≤ max_connections × 0.8
```

### 시나리오

- 11 서비스 × 5 인스턴스 × 10 = 550 (master) — RDS db.r5.large 면 1000 의 55% OK
- 11 서비스 × 10 인스턴스 × 10 = 1100 — *한계 초과* ⚠

### 처치 옵션

1. HPA maxReplicas cap (P2-10 과 묶어서)
2. ProxySQL/PgBouncer 도입
3. RDS instance class 업그레이드
4. 풀 사이즈 ↓ (서비스별 산정 후)

---

## P2-10: HPA maxReplicas cap (ADR)

### 제안

각 서비스의 HPA 에서 maxReplicas 를 *DB max_connections 역산* 으로 cap.

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: order-hpa
spec:
  minReplicas: 2
  maxReplicas: 10        # ← (max_conn × 0.8 / 서비스당 풀 / 서비스 수) 역산
```

### 산정 예

DB max_connections = 1000, 11개 서비스, 풀 10:
- 서비스당 max instances = 1000 × 0.8 / 11 / 10 = 7.3 → cap 7
- 트래픽 spike 큰 서비스 (order, product) 는 cap 10, 작은 서비스 (member, auth) 는 cap 5 차등

### 리스크

- 진짜 spike 시 throttling — circuit breaker / 급한 부하 흡수 한계
- ProxySQL 도입과 함께면 cap 완화 가능

---

## P3-11: Lettuce disconnectedBehavior 설정

### 변경

```kotlin
val clientOptions = ClusterClientOptions.builder()
    .topologyRefreshOptions(topologyRefreshOptions)
    .disconnectedBehavior(ClientOptions.DisconnectedBehavior.REJECT_COMMANDS)
    .build()
```

### 효과

- 재연결 중 명령을 *대기* 하지 않고 즉시 fail
- fail-fast → caller 가 fallback 또는 retry 가능
- 메모리 폭증 회피

### 리스크

- 짧은 reconnect 동안에도 fail 발생 → caller 가 retry 정책 갖춰야

---

## 적용 우선순위 요약

```
즉시 (PR, 1일)
└── P0-1: leak-detection-threshold
└── P0-2: connection-timeout 5s

1주 내 (PR + 검증)
├── P1-3: pool-name
├── P1-4: keepalive-time
├── P1-6: Lettuce Micrometer
└── P1-7: order 트랜잭션 검증

1달 내 (ADR + 점진 적용)
├── P1-5: DataSourceConfig 의 common 추출
├── P2-8: read-after-write stickiness
├── P2-9: DB max_connections 검증
├── P2-10: HPA maxReplicas cap
└── P3-11: Lettuce disconnectedBehavior
```

---

## ADR 문서 후보

`docs/adr/` 에 신규 작성 후보:

1. **ADR-XXXX-read-write-routing-common.md** — DataSourceConfig 의 common 추출
2. **ADR-XXXX-read-after-write-stickiness.md** — Redis 기반 stickiness
3. **ADR-XXXX-db-connection-budget.md** — DB max_connections 정책 + ProxySQL 도입 결정
4. **ADR-XXXX-hpa-replica-cap.md** — HPA cap 산정 정책

각 ADR 은 ADR-0026 docs-taxonomy (`docs/adr/ADR-0026-docs-taxonomy.md`) 의 정의 (구조 결정) 에 부합.

---

## 효과 추정

11개 서비스 P0~P1 적용 후:

- leak 추적 가능 — 운영 디버깅 시간 평균 2시간 → 10분
- 풀 메트릭 master/replica 분리 — 알람 정확도 ↑
- silent drop 검출 — 첫 트래픽 fail 90% 감소
- Lettuce metric 활성 — Redis 이상 5분 내 인지

P2 적용 후:

- read-after-write 사고 0
- DB max_connections 도달 위험 사전 차단

총 운영 안정성 영향: **상**.

---

## 핵심 포인트

- P0 두 개 (leak detection, connection timeout) 는 즉시 적용 — risk 없음, 효과 큼
- DataSourceConfig common 추출 + stickiness 도입은 ADR 필수 (구조 결정)
- DB max_connections + HPA cap 은 *함께* 결정 (서로 의존)
- 각 ADR 은 docs taxonomy (`docs/adr/ADR-0026-docs-taxonomy.md`) 의 ADR 정의 부합

## 다음 학습

- [18-interview-qa.md](18-interview-qa.md) — 면접 Q&A
- 각 ADR 초안을 docs/adr/ 에 실제 작성 (선택)
