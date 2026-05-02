---
parent: 15-connection-pool
seq: 15
title: msa 코드베이스 풀 설정 점검 — 11개 서비스 + Lettuce + 공용 자동설정
type: deep
created: 2026-05-01
---

# 15. msa 코드베이스 풀 설정 점검

이론을 코드에 매핑. 11개 JVM 서비스의 hikari 설정, gateway Lettuce, common Redis 자동 설정을 *현재 상태 기준으로 평가*.

---

## 11개 서비스 hikari 설정 일람

전수 조사 결과 (`grep -A 8 "hikari" */app/src/main/resources/application.yml`):

| 서비스 | master/replica 분리 | maximum-pool-size | minimum-idle | 외 옵션 |
|---|---|---|---|---|
| auth | ✅ | 10 / 10 | 2 / 2 | 없음 |
| chatbot | ✅ | 10 / 10 | 2 / 2 | 없음 |
| code-dictionary | ✅ | 10 / 10 | 2 / 2 | 없음 |
| fulfillment | ✅ | 10 / 10 | 2 / 2 | 없음 |
| gifticon | ✅ | 10 / 10 | 2 / 2 | 없음 |
| inventory | ✅ | 10 / 10 | 2 / 2 | 없음 |
| member | ✅ | 10 / 10 | 2 / 2 | 없음 |
| order | ✅ | 10 / 10 | 2 / 2 | 없음 |
| product | ✅ | 10 / 10 | 2 / 2 | 없음 |
| warehouse | ✅ | 10 / 10 | 2 / 2 | 없음 |
| wishlist | ✅ | 10 / 10 | 2 / 2 | 없음 |
| analytics | ⚠ ClickHouse 단일 | (default 10) | (default) | ClickHouse JDBC driver |
| experiment | ⚠ 단일 datasource | (default 10) | (default) | replica 없음 |
| search/app | ⚠ 단일 datasource | (default 10) | (default) | search 도메인 — DB 의존 작음 |
| quant | ⚠ 단일 datasource | (default 10) | (default) | trading 도메인 — 향후 검토 |

### 패턴 1: master/replica 분리 11개 서비스

```yaml
spring:
  datasource:
    master:
      jdbc-url: jdbc:mysql://...:3316/...
      hikari:
        maximum-pool-size: 10
        minimum-idle: 2
    replica:
      jdbc-url: jdbc:mysql://...:3317/...
      hikari:
        maximum-pool-size: 10
        minimum-idle: 2
```

→ 모든 11개 서비스가 *동일한* 패턴. `DataSourceConfig.kt` 에서 RoutingDataSource + LazyConnectionDataSourceProxy 로 라우팅.

### 패턴 2: 단일 datasource

experiment, quant, search/app, analytics — 각각 이유 다름:

- **experiment**: A/B 테스트 메타데이터 — 트래픽 작음, replica 도입 비용 > 이득
- **quant**: 신규 서비스, Phase 1 진행 중 — 미정
- **search/app**: 데이터는 ES, RDB 는 메타데이터 — 부하 작음
- **analytics**: ClickHouse 단일 (replica 다른 의미) — OLAP

---

## 평가: 누락된 운영 옵션

전 11개 서비스 *모두* 다음 옵션이 빠져 있다:

| 옵션 | 현재 | 권장 |
|---|---|---|
| `connection-timeout` | (default 30s) | 3000~5000 |
| `max-lifetime` | (default 30min) | 1800000 (그대로 OK) |
| `idle-timeout` | (default 10min) | 600000 (그대로 OK) |
| `keepalive-time` | (default off) | 30000 |
| `leak-detection-threshold` | (default off) | **10000 (prod 필수)** |
| `pool-name` | (auto-generated) | `{service}-master`, `{service}-replica` |
| `validation-timeout` | (default 5s) | 3000 |

`maximum-pool-size: 10` 자체는 평균 워크로드에 적정하지만, 위 7개 옵션 누락이 prod 운영 시 *진단 능력 부재* 를 만든다.

---

## 평가: maximum-pool-size 적정성 검증

[07-pool-sizing.md](07-pool-sizing.md) 의 Little's Law 로 추산.

### 가정

- 인스턴스 수 (HPA peak): 5
- DB max_connections: 100 (RDS db.t3.medium 가정)

### product (read heavy)

- RPS peak: 100
- 평균 쿼리 시간: 30ms (cache hit 90%)
- L = 100 × 0.03 = 3
- margin × 2 = 6 → 풀 8 충분
- 현재 10 → 적정 (master 5 인스턴스 × 10 = 50, DB 한계 100 의 50%)

### order (write heavy + 외부 IO)

- RPS peak: 50
- 평균 connection 점유: 200ms (결제 외부 IO 포함)
- L = 50 × 0.2 = 10
- margin × 2 = 20 → 풀 20 필요
- 현재 10 → **부족 위험** ⚠
- 단, ADR-0020 (`docs/adr/ADR-0020-transactional-usage.md`) 의 외부 IO 분리 패턴이 적용되면 점유 시간이 50ms 이하로 떨어져 풀 10 충분

### gifticon (멀티 도메인)

- RPS peak: 30
- 평균 점유: 80ms
- L = 30 × 0.08 = 2.4
- margin × 2 = 5 → 풀 5 충분
- 현재 10 → 적정 (여유)

### inventory (write heavy + lock)

- RPS peak: 80 (재고 차감)
- 평균 점유: 50ms (row lock 포함)
- L = 80 × 0.05 = 4
- margin × 2 = 8 → 풀 10 적정
- 현재 10 → 적정

### auth / member (인증 hot path)

- RPS peak: 200 (모든 요청에 토큰 검증)
- 평균 점유: 5ms (단순 조회)
- L = 200 × 0.005 = 1
- margin × 2 = 2 → 풀 5 충분
- 현재 10 → 여유

---

## DataSourceConfig.kt 코드 분석

11개 서비스가 다음과 *거의 동일한* 코드 보유.

```kotlin
// product/app/src/main/kotlin/com/kgd/product/config/DataSourceConfig.kt
enum class DataSourceType { MASTER, REPLICA }

class RoutingDataSource : AbstractRoutingDataSource() {
    override fun determineCurrentLookupKey(): DataSourceType =
        if (TransactionSynchronizationManager.isCurrentTransactionReadOnly())
            DataSourceType.REPLICA else DataSourceType.MASTER
}

@Configuration
class DataSourceConfig {

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

    @Bean
    fun jpaQueryFactory(entityManager: EntityManager): JPAQueryFactory =
        JPAQueryFactory(entityManager)
}
```

### 평가

- ✅ 3 컴포넌트 조합 ([09-reader-writer-routing.md](09-reader-writer-routing.md)) 완전 — RoutingDataSource + LazyConnectionDataSourceProxy + readOnly 결합
- ✅ default fallback = master (안전)
- ✅ JPAQueryFactory 까지 라우팅된 dataSource 사용
- ⚠ **중복 코드** — 11개 서비스가 같은 코드 11번 — common 으로 추출 가능
- ⚠ stickiness 없음 — read-after-write lag 케이스 미처리 ([10-replica-lag-consistency.md](10-replica-lag-consistency.md))
- ⚠ pool-name 미설정 — 메트릭에서 master/replica 구분 안 됨

---

## gateway Lettuce 설정 분석

`gateway/src/main/resources/application.yml`:

```yaml
spring:
  main:
    web-application-type: reactive          # WebFlux
  data:
    redis:
      cluster:
        nodes: [...6 node...]
        password: ${REDIS_PASSWORD:}
        max-redirects: 3
```

### 평가

- ✅ WebFlux + Lettuce 조합 — reactive 표준
- ✅ Cluster 6 노드 (3 master + 3 replica) — production 형태
- ✅ max-redirects 3 — slot 이동 시 적정
- ⚠ commandTimeout 명시 없음 → common Redis 자동설정 (`common/src/main/kotlin/com/kgd/common/redis/CommonRedisAutoConfiguration.kt`) 의 2s 적용
- ⚠ pool 설정 없음 → single multiplex (적정)

---

## common Redis 자동 설정 분석

`common/src/main/kotlin/com/kgd/common/redis/CommonRedisAutoConfiguration.kt`:

```kotlin
@AutoConfiguration(afterName = [...DataRedisAutoConfiguration])
@ConditionalOnProperty(prefix = "kgd.common.redis", name = ["enabled"], havingValue = "true")
@ConditionalOnProperty(prefix = "spring.data.redis.cluster", name = ["nodes"])
class CommonRedisAutoConfiguration {

    @Bean
    fun lettuceConnectionFactory(...): LettuceConnectionFactory {
        val topologyRefreshOptions = ClusterTopologyRefreshOptions.builder()
            .enablePeriodicRefresh(Duration.ofMinutes(10))
            .enableAllAdaptiveRefreshTriggers()
            .build()

        val clientOptions = ClusterClientOptions.builder()
            .topologyRefreshOptions(topologyRefreshOptions)
            .build()

        val lettuceClientConfig = LettuceClientConfiguration.builder()
            .clientOptions(clientOptions)
            .commandTimeout(Duration.ofSeconds(2))
            .build()

        return LettuceConnectionFactory(clusterConfiguration, lettuceClientConfig)
    }
}
```

### 평가

- ✅ topologyRefreshOptions — periodic 10min + adaptive 모두 활성
- ✅ commandTimeout 2s — fail-fast
- ✅ ConditionalOnProperty — cluster 환경만 활성, k3s-lite standalone 은 우회
- ⚠ disconnectedBehavior 미설정 → default `DEFAULT` (재연결 동안 명령 대기)
  - 운영 권장: `REJECT_COMMANDS` (fail-fast) 검토
- ⚠ ClientResources 공유 안 함 — 다중 LettuceConnectionFactory 시 EventLoop thread 중복 (현재는 하나라 OK)
- ⚠ Lettuce metrics (Micrometer) 활성 안 됨 — observability 부족

---

## standalone 전환 (k3s-lite overlay)

k3s-lite kustomization (`k8s/overlays/k3s-lite/kustomization.yaml`):

```yaml
patches:
  - path: patches/redis-standalone-gateway.yaml
    target: { kind: Deployment, name: gateway }
  - path: patches/redis-standalone-product.yaml
    target: { kind: Deployment, name: product }
  - path: patches/redis-standalone-gifticon.yaml
  - path: patches/redis-standalone-analytics.yaml
  - path: patches/redis-standalone-experiment.yaml
```

5개 서비스가 `SPRING_APPLICATION_JSON` env var 로 cluster → standalone override.

### 평가

- ✅ K8s overlay 로 환경별 분리 — 코드 변경 없음
- ✅ 단일 Redis 인스턴스로 k3d 단일 노드 부담 감소
- ⚠ 운영 (prod-k8s) 은 cluster 그대로 — 검증 환경 차이 인지 필요

---

## DB 측 max_connections 검증

가정: AWS RDS db.r5.large (1000 max_connections).

```
master:  11 서비스 × HPA peak 5 × pool 10 = 550 connection
replica: 11 서비스 × HPA peak 5 × pool 10 = 550 connection (다른 host)
```

→ master / replica 가 *별개 host* 라 각 550 — 한계 1000 의 55%. 안전.

만약 db.t3.medium (max 100) 일 경우:

```
master: 550 > 100   ⚠ 대규모 fail
```

→ 인스턴스 수 cap 또는 ProxySQL 도입 필요. msa 가 prod 에서 어떤 instance class 인지 확인 필요 (현재 `k8s/infra/prod` 에 명시).

---

## 종합 점수

| 영역 | 평가 |
|---|---|
| R/W 분리 패턴 | A — 표준 3-컴포넌트 모두 적용 |
| 풀 사이즈 | B+ — 적정하지만 order 는 ADR-0020 가 필수 |
| 운영 옵션 (timeout, leak detection) | C — 모든 서비스 누락 |
| Lettuce Cluster 설정 | A- — adaptive refresh + commandTimeout |
| Lettuce 메트릭 | D — 활성 안 됨 |
| pool-name | F — 메트릭 분리 불가 |
| stickiness (read-after-write) | F — 미구현 |
| 코드 중복 | C — 11개 DataSourceConfig 중복 |

종합: B-. 핵심 설계는 좋으나 *운영 가시성* 과 *코드 중복* 이 약점.

---

## 즉시 적용 가능 개선 (low risk, high value)

1. 11개 서비스에 `leak-detection-threshold: 10000` 추가
2. 11개 서비스에 `connection-timeout: 5000` 추가
3. 11개 서비스에 `pool-name: {service}-{master|replica}` 추가
4. common 으로 RoutingDataSource 추출
5. Lettuce metrics Micrometer 활성

→ [17-improvements.md](17-improvements.md) 에서 구체화.

---

## 핵심 포인트

- 11개 서비스가 모두 R/W 분리 표준 패턴으로 일관됨 — 강점
- 운영 옵션 (leak detection, timeout, pool-name) 누락이 공통 약점
- order 서비스는 트랜잭션 외부 IO 분리 (ADR-0020, `docs/adr/ADR-0020-transactional-usage.md`) 가 풀 사이즈와 직결
- Lettuce 설정은 production-ready, 단 메트릭 활성 추가 필요
- DataSourceConfig.kt 11개 중복 — common 추출 후보

## 다음 학습

- [16-pool-exhaustion-drill.md](16-pool-exhaustion-drill.md) — 위 부족분이 어떻게 *진단 시 시간 비용* 으로 나타나는가
- [17-improvements.md](17-improvements.md) — 위 8개 개선 우선순위
