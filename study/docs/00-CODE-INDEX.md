# msa Code → Study Notes 역인덱스

> 코드/문서 변경 시 영향받는 학습 노트(`study/docs/`)를 찾기 위한 역방향 매핑.  
> 학습 노트의 Phase 3(코드 grounding) 인용 + 본문 내 path 언급을 모두 수집.  
> 생성일: 2026-05-02 · 스캔 대상: `study/docs/` (361 개 .md)  
> 총 raw 매칭 442 건 · 고유 (학습노트, 코드경로) 쌍 373 건 · 고유 코드 경로 195 개

**축약 표기**: 일부 경로는 학습 노트에서 짧게 언급된 형태(예: `auth/AuthService.kt`)로,  
실제 저장소에 동일 경로 파일이 없을 수 있다. 이런 경로는 `<sub>(미존재/축약)</sub>` 로 표시.  
개념적/계획 단계 인용도 함께 보존하기 위함.

---

## §0 목차

- [§1 Top 50 가장 많이 인용된 paths](#1-top-50-가장-많이-인용된-paths)
- [§2 By Service](#2-by-service)
  - [§2.common](#common)
  - [§2.gateway](#gateway)
  - [§2.quant](#quant)
  - [§2.order](#order)
  - [§2.product](#product)
  - [§2.inventory](#inventory)
  - [§2.analytics](#analytics)
  - [§2.auth](#auth)
  - [§2.fulfillment](#fulfillment)
  - [§2.agent-viewer](#agent-viewer)
  - [§2.gifticon](#gifticon)
  - [§2.chatbot](#chatbot)
  - [§2.ai](#ai)
  - [§2.search](#search)
- [§2.5 Infra & Build](#25-infra--build)
- [§3 ADR (Architecture Decision Record, 아키텍처 결정 기록) 역인덱스](#3-adr-역인덱스)
- [§4 Convention / Architecture / Standards / Spec / Plan 역인덱스](#4-convention--architecture--standards--spec--plan-역인덱스)
- [§5 Path Type 통계](#5-path-type-통계)
- [§6 Forward Index — 학습 노트별 인용 코드](#6-forward-index--학습-노트별-인용-코드)
- [§7 사용 시나리오](#7-사용-시나리오)
- [§8 운영 메모](#8-운영-메모)

---

## §1 Top 50 가장 많이 인용된 paths

코드/문서 단일 변경의 "학습 노트 영향 반경" 이 가장 큰 paths. 이들 변경 시 우선 검토.

| Rank | msa path | 인용 수 | 학습 노트 |
|---:|---|---:|---|
| 1 | [`build.gradle.kts`](../../build.gradle.kts) | 20 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md), [10-observability/02-prometheus-pull-model.md](10-observability/02-prometheus-pull-model.md), [10-observability/08-opentelemetry-tracing.md](10-observability/08-opentelemetry-tracing.md), [10-observability/13-improvements.md](10-observability/13-improvements.md), [11-k8s-deep-dive/16-improvements.md](11-k8s-deep-dive/16-improvements.md), [12-latency-numbers/08-observability-setup.md](12-latency-numbers/08-observability-setup.md), [16-async-nonblocking-io/18-improvements.md](16-async-nonblocking-io/18-improvements.md), [17-spring-web/08-spring-aop.md](17-spring-web/08-spring-aop.md), [17-spring-web/13-jackson-naming-perf.md](17-spring-web/13-jackson-naming-perf.md), [18-grpc/05-codegen-stubs.md](18-grpc/05-codegen-stubs.md), [18-grpc/17-proto-monorepo-strategy.md](18-grpc/17-proto-monorepo-strategy.md), [18-grpc/18-virtual-migration-product.md](18-grpc/18-virtual-migration-product.md), [18-grpc/19-improvements.md](18-grpc/19-improvements.md), [2-jvm-gc/00-plan.md](2-jvm-gc/00-plan.md), [2-jvm-gc/07-zgc-deep.md](2-jvm-gc/07-zgc-deep.md), [2-jvm-gc/17-lab-jmh.md](2-jvm-gc/17-lab-jmh.md), [2-jvm-gc/18-msa-jib-config.md](2-jvm-gc/18-msa-jib-config.md), [2-jvm-gc/20-observability-prometheus.md](2-jvm-gc/20-observability-prometheus.md), [2-jvm-gc/21-improvements.md](2-jvm-gc/21-improvements.md), [5-spring-transactional/01-aop-proxy-basics.md](5-spring-transactional/01-aop-proxy-basics.md) |
| 2 | [`docs/adr/ADR-0020-transactional-usage.md`](../../docs/adr/ADR-0020-transactional-usage.md) | 10 | [00-INDEX.md](00-INDEX.md), [15-connection-pool/08-pool-failure-patterns.md](15-connection-pool/08-pool-failure-patterns.md), [15-connection-pool/09-reader-writer-routing.md](15-connection-pool/09-reader-writer-routing.md), [15-connection-pool/10-replica-lag-consistency.md](15-connection-pool/10-replica-lag-consistency.md), [15-connection-pool/15-codebase-audit.md](15-connection-pool/15-codebase-audit.md), [15-connection-pool/16-pool-exhaustion-drill.md](15-connection-pool/16-pool-exhaustion-drill.md), [15-connection-pool/17-improvements.md](15-connection-pool/17-improvements.md), [15-connection-pool/18-interview-qa.md](15-connection-pool/18-interview-qa.md), [4-db-index-transaction/00-plan.md](4-db-index-transaction/00-plan.md), [5-spring-transactional/00-plan.md](5-spring-transactional/00-plan.md) |
| 3 | [`common/src/main/kotlin/com/kgd/common/redis/CommonRedisAutoConfiguration.kt`](../../common/src/main/kotlin/com/kgd/common/redis/CommonRedisAutoConfiguration.kt) | 8 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md), [15-connection-pool/11-redis-lettuce-vs-jedis.md](15-connection-pool/11-redis-lettuce-vs-jedis.md), [15-connection-pool/12-redis-pool-tuning.md](15-connection-pool/12-redis-pool-tuning.md), [15-connection-pool/15-codebase-audit.md](15-connection-pool/15-codebase-audit.md), [15-connection-pool/17-improvements.md](15-connection-pool/17-improvements.md), [15-connection-pool/18-interview-qa.md](15-connection-pool/18-interview-qa.md), [16-async-nonblocking-io/16-lettuce-kafka-nio.md](16-async-nonblocking-io/16-lettuce-kafka-nio.md), [9-redis-deep-dive/17-msa-application.md](9-redis-deep-dive/17-msa-application.md) |
| 4 | [`k8s/infra/prod/monitoring/servicemonitor-apps.yaml`](../../k8s/infra/prod/monitoring/servicemonitor-apps.yaml) | 8 | [10-observability/01-observability-foundations.md](10-observability/01-observability-foundations.md), [10-observability/02-prometheus-pull-model.md](10-observability/02-prometheus-pull-model.md), [10-observability/12-msa-current-state.md](10-observability/12-msa-current-state.md), [10-observability/14-interview-qa.md](10-observability/14-interview-qa.md), [11-k8s-deep-dive/02-core-resources.md](11-k8s-deep-dive/02-core-resources.md), [11-k8s-deep-dive/09-autoscaling.md](11-k8s-deep-dive/09-autoscaling.md), [11-k8s-deep-dive/15-msa-k8s-grep.md](11-k8s-deep-dive/15-msa-k8s-grep.md), [2-jvm-gc/20-observability-prometheus.md](2-jvm-gc/20-observability-prometheus.md) |
| 5 | [`k8s/infra/local/redis/statefulset.yaml`](../../k8s/infra/local/redis/statefulset.yaml) | 7 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md), [11-k8s-deep-dive/07-storage.md](11-k8s-deep-dive/07-storage.md), [9-redis-deep-dive/05-ttl-and-eviction.md](9-redis-deep-dive/05-ttl-and-eviction.md), [9-redis-deep-dive/06-rdb-persistence.md](9-redis-deep-dive/06-rdb-persistence.md), [9-redis-deep-dive/07-aof-persistence.md](9-redis-deep-dive/07-aof-persistence.md), [9-redis-deep-dive/16-memory-and-pitfalls.md](9-redis-deep-dive/16-memory-and-pitfalls.md), [9-redis-deep-dive/18-improvements.md](9-redis-deep-dive/18-improvements.md) |
| 6 | [`docs/adr/ADR-0012-idempotent-consumer.md`](../../docs/adr/ADR-0012-idempotent-consumer.md) | 6 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md), [00-INDEX.md](00-INDEX.md), [12-latency-numbers/05-tail-and-fanout.md](12-latency-numbers/05-tail-and-fanout.md), [15-connection-pool/18-interview-qa.md](15-connection-pool/18-interview-qa.md), [6-kafka-internals/00-plan.md](6-kafka-internals/00-plan.md), [7-distributed-systems/00-plan.md](7-distributed-systems/00-plan.md) |
| 7 | [`docs/adr/ADR-0015-resilience-strategy.md`](../../docs/adr/ADR-0015-resilience-strategy.md) | 6 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md), [00-INDEX.md](00-INDEX.md), [12-latency-numbers/05-tail-and-fanout.md](12-latency-numbers/05-tail-and-fanout.md), [15-connection-pool/12-redis-pool-tuning.md](15-connection-pool/12-redis-pool-tuning.md), [6-kafka-internals/00-plan.md](6-kafka-internals/00-plan.md), [7-distributed-systems/00-plan.md](7-distributed-systems/00-plan.md) |
| 8 | [`docs/conventions/logging.md`](../../docs/conventions/logging.md) | 6 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md), [10-observability/06-logs-elk-vs-loki.md](10-observability/06-logs-elk-vs-loki.md), [10-observability/07-structured-logging-correlation.md](10-observability/07-structured-logging-correlation.md), [10-observability/12-msa-current-state.md](10-observability/12-msa-current-state.md), [10-observability/13-improvements.md](10-observability/13-improvements.md), [10-observability/14-interview-qa.md](10-observability/14-interview-qa.md) |
| 9 | `gateway/ingress.yaml` <sub>(미존재/축약)</sub> | 6 | [1-aws-network/09-alb.md](1-aws-network/09-alb.md), [1-aws-network/13-eks-networking.md](1-aws-network/13-eks-networking.md), [1-aws-network/17-msa-mapping.md](1-aws-network/17-msa-mapping.md), [11-k8s-deep-dive/06-ingress-gateway-api.md](11-k8s-deep-dive/06-ingress-gateway-api.md), [17-spring-web/01-http-pipeline.md](17-spring-web/01-http-pipeline.md), [17-spring-web/14-gzip-layers.md](17-spring-web/14-gzip-layers.md) |
| 10 | [`k8s/base/gateway/ingress.yaml`](../../k8s/base/gateway/ingress.yaml) | 6 | [1-aws-network/09-alb.md](1-aws-network/09-alb.md), [1-aws-network/13-eks-networking.md](1-aws-network/13-eks-networking.md), [1-aws-network/17-msa-mapping.md](1-aws-network/17-msa-mapping.md), [11-k8s-deep-dive/06-ingress-gateway-api.md](11-k8s-deep-dive/06-ingress-gateway-api.md), [17-spring-web/01-http-pipeline.md](17-spring-web/01-http-pipeline.md), [17-spring-web/14-gzip-layers.md](17-spring-web/14-gzip-layers.md) |
| 11 | [`k8s/infra/prod/redis/values.yaml`](../../k8s/infra/prod/redis/values.yaml) | 6 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md), [9-redis-deep-dive/00-preview.md](9-redis-deep-dive/00-preview.md), [9-redis-deep-dive/07-aof-persistence.md](9-redis-deep-dive/07-aof-persistence.md), [9-redis-deep-dive/09-cluster-slots.md](9-redis-deep-dive/09-cluster-slots.md), [9-redis-deep-dive/17-msa-application.md](9-redis-deep-dive/17-msa-application.md), [9-redis-deep-dive/18-improvements.md](9-redis-deep-dive/18-improvements.md) |
| 12 | [`product/app/src/main/kotlin/com/kgd/product/config/DataSourceConfig.kt`](../../product/app/src/main/kotlin/com/kgd/product/config/DataSourceConfig.kt) | 6 | [15-connection-pool/00-preview.md](15-connection-pool/00-preview.md), [15-connection-pool/03-spring-boot-defaults.md](15-connection-pool/03-spring-boot-defaults.md), [15-connection-pool/09-reader-writer-routing.md](15-connection-pool/09-reader-writer-routing.md), [15-connection-pool/15-codebase-audit.md](15-connection-pool/15-codebase-audit.md), [15-connection-pool/17-improvements.md](15-connection-pool/17-improvements.md), [15-connection-pool/18-interview-qa.md](15-connection-pool/18-interview-qa.md) |
| 13 | [`docs/adr/ADR-0025-latency-budget.md`](../../docs/adr/ADR-0025-latency-budget.md) | 5 | [10-observability/12-msa-current-state.md](10-observability/12-msa-current-state.md), [12-latency-numbers/00-plan.md](12-latency-numbers/00-plan.md), [12-latency-numbers/00-preview.md](12-latency-numbers/00-preview.md), [12-latency-numbers/12-adr-draft.md](12-latency-numbers/12-adr-draft.md), [15-connection-pool/01-pool-fundamentals.md](15-connection-pool/01-pool-fundamentals.md) |
| 14 | `auth/AuthService.kt` <sub>(미존재/축약)</sub> | 4 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md), [3-java-kotlin-concurrency/08-concurrent-collections.md](3-java-kotlin-concurrency/08-concurrent-collections.md), [3-java-kotlin-concurrency/22-msa-concurrency-patterns.md](3-java-kotlin-concurrency/22-msa-concurrency-patterns.md), [3-java-kotlin-concurrency/23-improvements.md](3-java-kotlin-concurrency/23-improvements.md) |
| 15 | [`docs/adr/ADR-0019-k8s-migration.md`](../../docs/adr/ADR-0019-k8s-migration.md) | 4 | [00-INDEX.md](00-INDEX.md), [1-aws-network/01-vpc.md](1-aws-network/01-vpc.md), [11-k8s-deep-dive/00-plan.md](11-k8s-deep-dive/00-plan.md), [14-crdt-mrdt/17-msa-application.md](14-crdt-mrdt/17-msa-application.md) |
| 16 | [`docs/architecture/kafka-convention.md`](../../docs/architecture/kafka-convention.md) | 4 | [00-LEARNING-GUIDE.md](00-LEARNING-GUIDE.md), [1-aws-network/14-cross-az-cost.md](1-aws-network/14-cross-az-cost.md), [6-kafka-internals/00-plan.md](6-kafka-internals/00-plan.md), [6-kafka-internals/11-msa-codebase-grep.md](6-kafka-internals/11-msa-codebase-grep.md) |
| 17 | [`docs/conventions/transactional-usage.md`](../../docs/conventions/transactional-usage.md) | 4 | [5-spring-transactional/01-aop-proxy-basics.md](5-spring-transactional/01-aop-proxy-basics.md), [5-spring-transactional/06-readonly-vs-writable.md](5-spring-transactional/06-readonly-vs-writable.md), [5-spring-transactional/08-class-level-pitfalls.md](5-spring-transactional/08-class-level-pitfalls.md), [5-spring-transactional/11-msa-mapping.md](5-spring-transactional/11-msa-mapping.md) |
| 18 | [`gateway/src/main/kotlin/com/kgd/gateway/config/RateLimiterConfig.kt`](../../gateway/src/main/kotlin/com/kgd/gateway/config/RateLimiterConfig.kt) | 4 | [17-spring-web/17-msa-gateway-filter.md](17-spring-web/17-msa-gateway-filter.md), [7-distributed-systems/12-bulkhead-ratelimit.md](7-distributed-systems/12-bulkhead-ratelimit.md), [8-system-design/06-rate-limiter.md](8-system-design/06-rate-limiter.md), [9-redis-deep-dive/17-msa-application.md](9-redis-deep-dive/17-msa-application.md) |
| 19 | [`gateway/src/main/kotlin/com/kgd/gateway/filter/AuthenticationGatewayFilter.kt`](../../gateway/src/main/kotlin/com/kgd/gateway/filter/AuthenticationGatewayFilter.kt) | 4 | [13-crypto-jwt-sso/00-plan.md](13-crypto-jwt-sso/00-plan.md), [16-async-nonblocking-io/15-msa-gateway-webflux.md](16-async-nonblocking-io/15-msa-gateway-webflux.md), [17-spring-web/02-filter-vs-interceptor-vs-aop.md](17-spring-web/02-filter-vs-interceptor-vs-aop.md), [17-spring-web/17-msa-gateway-filter.md](17-spring-web/17-msa-gateway-filter.md) |
| 20 | `k8s/infra/local/ingress-nginx/values.yaml` <sub>(미존재/축약)</sub> | 4 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md), [17-spring-web/14-gzip-layers.md](17-spring-web/14-gzip-layers.md), [17-spring-web/18-msa-common-patterns.md](17-spring-web/18-msa-common-patterns.md), [17-spring-web/19-improvements.md](17-spring-web/19-improvements.md) |
| 21 | [`k8s/infra/prod/strimzi/kafka-cluster.yaml`](../../k8s/infra/prod/strimzi/kafka-cluster.yaml) | 4 | [11-k8s-deep-dive/15-msa-k8s-grep.md](11-k8s-deep-dive/15-msa-k8s-grep.md), [6-kafka-internals/03-controller-kraft.md](6-kafka-internals/03-controller-kraft.md), [6-kafka-internals/06-replication-isr.md](6-kafka-internals/06-replication-isr.md), [6-kafka-internals/11-msa-codebase-grep.md](6-kafka-internals/11-msa-codebase-grep.md) |
| 22 | [`product/app/build.gradle.kts`](../../product/app/build.gradle.kts) | 4 | [10-observability/02-prometheus-pull-model.md](10-observability/02-prometheus-pull-model.md), [10-observability/08-opentelemetry-tracing.md](10-observability/08-opentelemetry-tracing.md), [18-grpc/18-virtual-migration-product.md](18-grpc/18-virtual-migration-product.md), [2-jvm-gc/20-observability-prometheus.md](2-jvm-gc/20-observability-prometheus.md) |
| 23 | `quant/BithumbWebSocketSubscriber.kt` <sub>(미존재/축약)</sub> | 4 | [3-java-kotlin-concurrency/07-executor-threadpool.md](3-java-kotlin-concurrency/07-executor-threadpool.md), [3-java-kotlin-concurrency/09-jmm-happens-before.md](3-java-kotlin-concurrency/09-jmm-happens-before.md), [3-java-kotlin-concurrency/16-structured-concurrency.md](3-java-kotlin-concurrency/16-structured-concurrency.md), [3-java-kotlin-concurrency/22-msa-concurrency-patterns.md](3-java-kotlin-concurrency/22-msa-concurrency-patterns.md) |
| 24 | `quant/NotificationDispatcher.kt` <sub>(미존재/축약)</sub> | 4 | [3-java-kotlin-concurrency/07-executor-threadpool.md](3-java-kotlin-concurrency/07-executor-threadpool.md), [3-java-kotlin-concurrency/14-coroutine-internals.md](3-java-kotlin-concurrency/14-coroutine-internals.md), [3-java-kotlin-concurrency/16-structured-concurrency.md](3-java-kotlin-concurrency/16-structured-concurrency.md), [3-java-kotlin-concurrency/22-msa-concurrency-patterns.md](3-java-kotlin-concurrency/22-msa-concurrency-patterns.md) |
| 25 | `analytics/EventIngestionConsumer.kt` <sub>(미존재/축약)</sub> | 3 | [3-java-kotlin-concurrency/02-synchronized-monitor.md](3-java-kotlin-concurrency/02-synchronized-monitor.md), [3-java-kotlin-concurrency/21-profiling-tools.md](3-java-kotlin-concurrency/21-profiling-tools.md), [3-java-kotlin-concurrency/22-msa-concurrency-patterns.md](3-java-kotlin-concurrency/22-msa-concurrency-patterns.md) |
| 26 | [`common/build.gradle.kts`](../../common/build.gradle.kts) | 3 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md), [10-observability/13-improvements.md](10-observability/13-improvements.md), [2-jvm-gc/20-observability-prometheus.md](2-jvm-gc/20-observability-prometheus.md) |
| 27 | [`common/src/main/kotlin/com/kgd/common/jackson/CommonJacksonAutoConfiguration.kt`](../../common/src/main/kotlin/com/kgd/common/jackson/CommonJacksonAutoConfiguration.kt) | 3 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md), [17-spring-web/09-jackson-objectmapper.md](17-spring-web/09-jackson-objectmapper.md), [17-spring-web/18-msa-common-patterns.md](17-spring-web/18-msa-common-patterns.md) |
| 28 | [`docs/specs/2026-04-09-monitoring-infrastructure-design.md`](../../docs/specs/2026-04-09-monitoring-infrastructure-design.md) | 3 | [10-observability/00-plan.md](10-observability/00-plan.md), [10-observability/05-grafana-dashboards.md](10-observability/05-grafana-dashboards.md), [10-observability/12-msa-current-state.md](10-observability/12-msa-current-state.md) |
| 29 | `gateway/application.yml` <sub>(미존재/축약)</sub> | 3 | [15-connection-pool/13-reactive-r2dbc.md](15-connection-pool/13-reactive-r2dbc.md), [15-connection-pool/15-codebase-audit.md](15-connection-pool/15-codebase-audit.md), [15-connection-pool/18-interview-qa.md](15-connection-pool/18-interview-qa.md) |
| 30 | [`gateway/build.gradle.kts`](../../gateway/build.gradle.kts) | 3 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md), [16-async-nonblocking-io/18-improvements.md](16-async-nonblocking-io/18-improvements.md), [2-jvm-gc/21-improvements.md](2-jvm-gc/21-improvements.md) |
| 31 | [`gateway/src/main/resources/application.yml`](../../gateway/src/main/resources/application.yml) | 3 | [15-connection-pool/13-reactive-r2dbc.md](15-connection-pool/13-reactive-r2dbc.md), [15-connection-pool/15-codebase-audit.md](15-connection-pool/15-codebase-audit.md), [15-connection-pool/18-interview-qa.md](15-connection-pool/18-interview-qa.md) |
| 32 | [`k8s/infra/prod/strimzi/kafka-topics.yaml`](../../k8s/infra/prod/strimzi/kafka-topics.yaml) | 3 | [6-kafka-internals/01-broker-topic-partition.md](6-kafka-internals/01-broker-topic-partition.md), [6-kafka-internals/06-replication-isr.md](6-kafka-internals/06-replication-isr.md), [6-kafka-internals/11-msa-codebase-grep.md](6-kafka-internals/11-msa-codebase-grep.md) |
| 33 | [`order/app/src/main/resources/application.yml`](../../order/app/src/main/resources/application.yml) | 3 | [15-connection-pool/16-pool-exhaustion-drill.md](15-connection-pool/16-pool-exhaustion-drill.md), [3-java-kotlin-concurrency/17-virtual-threads.md](3-java-kotlin-concurrency/17-virtual-threads.md), [6-kafka-internals/11-msa-codebase-grep.md](6-kafka-internals/11-msa-codebase-grep.md) |
| 34 | `quant/MarketDataHub.kt` <sub>(미존재/축약)</sub> | 3 | [3-java-kotlin-concurrency/08-concurrent-collections.md](3-java-kotlin-concurrency/08-concurrent-collections.md), [3-java-kotlin-concurrency/15-flow-channel.md](3-java-kotlin-concurrency/15-flow-channel.md), [3-java-kotlin-concurrency/22-msa-concurrency-patterns.md](3-java-kotlin-concurrency/22-msa-concurrency-patterns.md) |
| 35 | `analytics/ScoreCacheAdapter.kt` <sub>(미존재/축약)</sub> | 2 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md), [9-redis-deep-dive/18-improvements.md](9-redis-deep-dive/18-improvements.md) |
| 36 | `common/src/main/kotlin/com/kgd/common/datasource/CommonDataSourceAutoConfiguration.kt` <sub>(미존재/축약)</sub> | 2 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md), [15-connection-pool/17-improvements.md](15-connection-pool/17-improvements.md) |
| 37 | `common/src/main/kotlin/com/kgd/common/datasource/Stickiness.kt` <sub>(미존재/축약)</sub> | 2 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md), [15-connection-pool/17-improvements.md](15-connection-pool/17-improvements.md) |
| 38 | `common/src/main/kotlin/com/kgd/common/messaging/IdempotentEventHandler.kt` <sub>(미존재/축약)</sub> | 2 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md), [7-distributed-systems/19-improvements.md](7-distributed-systems/19-improvements.md) |
| 39 | [`common/src/main/kotlin/com/kgd/common/security/AesUtil.kt`](../../common/src/main/kotlin/com/kgd/common/security/AesUtil.kt) | 2 | [13-crypto-jwt-sso/00-plan.md](13-crypto-jwt-sso/00-plan.md), [13-crypto-jwt-sso/02-aes-modes.md](13-crypto-jwt-sso/02-aes-modes.md) |
| 40 | `common/src/main/kotlin/com/kgd/common/web/TraceIdFilter.kt` <sub>(미존재/축약)</sub> | 2 | [17-spring-web/18-msa-common-patterns.md](17-spring-web/18-msa-common-patterns.md), [17-spring-web/19-improvements.md](17-spring-web/19-improvements.md) |
| 41 | [`docs/adr/ADR-0011-inventory-fulfillment-service.md`](../../docs/adr/ADR-0011-inventory-fulfillment-service.md) | 2 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md), [7-distributed-systems/00-plan.md](7-distributed-systems/00-plan.md) |
| 42 | `fulfillment/OutboxPollingPublisher.kt` <sub>(미존재/축약)</sub> | 2 | [3-java-kotlin-concurrency/22-msa-concurrency-patterns.md](3-java-kotlin-concurrency/22-msa-concurrency-patterns.md), [7-distributed-systems/14-outbox-inbox-cdc.md](7-distributed-systems/14-outbox-inbox-cdc.md) |
| 43 | [`gateway/CLAUDE.md`](../../gateway/CLAUDE.md) | 2 | [16-async-nonblocking-io/12-webflux-vs-mvc.md](16-async-nonblocking-io/12-webflux-vs-mvc.md), [16-async-nonblocking-io/15-msa-gateway-webflux.md](16-async-nonblocking-io/15-msa-gateway-webflux.md) |
| 44 | `gateway/RateLimiterConfig.kt` <sub>(미존재/축약)</sub> | 2 | [8-system-design/00-preview.md](8-system-design/00-preview.md), [8-system-design/06-rate-limiter.md](8-system-design/06-rate-limiter.md) |
| 45 | `gateway/app/src/main/resources/application.yml` <sub>(미존재/축약)</sub> | 2 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md), [15-connection-pool/00-plan.md](15-connection-pool/00-plan.md) |
| 46 | `gateway/deployment.yaml` <sub>(미존재/축약)</sub> | 2 | [11-k8s-deep-dive/02-core-resources.md](11-k8s-deep-dive/02-core-resources.md), [11-k8s-deep-dive/15-msa-k8s-grep.md](11-k8s-deep-dive/15-msa-k8s-grep.md) |
| 47 | `gateway/ingress-private.yaml` <sub>(미존재/축약)</sub> | 2 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md), [17-spring-web/19-improvements.md](17-spring-web/19-improvements.md) |
| 48 | [`gateway/src/main/kotlin/com/kgd/gateway/config/GatewayRouteConfig.kt`](../../gateway/src/main/kotlin/com/kgd/gateway/config/GatewayRouteConfig.kt) | 2 | [16-async-nonblocking-io/15-msa-gateway-webflux.md](16-async-nonblocking-io/15-msa-gateway-webflux.md), [7-distributed-systems/12-bulkhead-ratelimit.md](7-distributed-systems/12-bulkhead-ratelimit.md) |
| 49 | [`gateway/src/main/kotlin/com/kgd/gateway/config/SecurityConfig.kt`](../../gateway/src/main/kotlin/com/kgd/gateway/config/SecurityConfig.kt) | 2 | [17-spring-web/06-security-filter-chain.md](17-spring-web/06-security-filter-chain.md), [17-spring-web/17-msa-gateway-filter.md](17-spring-web/17-msa-gateway-filter.md) |
| 50 | [`gateway/src/main/kotlin/com/kgd/gateway/filter/RequestLoggingFilter.kt`](../../gateway/src/main/kotlin/com/kgd/gateway/filter/RequestLoggingFilter.kt) | 2 | [17-spring-web/02-filter-vs-interceptor-vs-aop.md](17-spring-web/02-filter-vs-interceptor-vs-aop.md), [17-spring-web/17-msa-gateway-filter.md](17-spring-web/17-msa-gateway-filter.md) |

---

## §2 By Service

서비스별로 인용된 코드/설정/문서 경로. 같은 서비스 내 경로가 변경될 때 영향 범위 산정에 사용.

**서비스 우선순위** (인용 수 기준 desc):

- `common` — 33 개 경로 / 49 건 인용
- `gateway` — 23 개 경로 / 49 건 인용
- `quant` — 17 개 경로 / 27 건 인용
- `order` — 13 개 경로 / 20 건 인용
- `product` — 8 개 경로 / 17 건 인용
- `inventory` — 10 개 경로 / 11 건 인용
- `analytics` — 2 개 경로 / 5 건 인용
- `auth` — 1 개 경로 / 4 건 인용
- `fulfillment` — 2 개 경로 / 3 건 인용
- `agent-viewer` — 2 개 경로 / 2 건 인용
- `gifticon` — 1 개 경로 / 2 건 인용
- `chatbot` — 1 개 경로 / 1 건 인용
- `ai` — 1 개 경로 / 1 건 인용
- `search` — 1 개 경로 / 1 건 인용

### common

_총 33 개 경로, 49 건 인용_

_Kind 분포_: `code-jvm`=28 / `config`=4 / `gradle`=1

| Path | Kind | 인용 학습 노트 |
|---|---|---|
| [`common/src/main/kotlin/com/kgd/common/redis/CommonRedisAutoConfiguration.kt`](../../common/src/main/kotlin/com/kgd/common/redis/CommonRedisAutoConfiguration.kt) | `code-jvm` | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md), [15-connection-pool/11-redis-lettuce-vs-jedis.md](15-connection-pool/11-redis-lettuce-vs-jedis.md), [15-connection-pool/12-redis-pool-tuning.md](15-connection-pool/12-redis-pool-tuning.md), [15-connection-pool/15-codebase-audit.md](15-connection-pool/15-codebase-audit.md), [15-connection-pool/17-improvements.md](15-connection-pool/17-improvements.md), [15-connection-pool/18-interview-qa.md](15-connection-pool/18-interview-qa.md), [16-async-nonblocking-io/16-lettuce-kafka-nio.md](16-async-nonblocking-io/16-lettuce-kafka-nio.md), [9-redis-deep-dive/17-msa-application.md](9-redis-deep-dive/17-msa-application.md) |
| [`common/build.gradle.kts`](../../common/build.gradle.kts) | `gradle` | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md), [10-observability/13-improvements.md](10-observability/13-improvements.md), [2-jvm-gc/20-observability-prometheus.md](2-jvm-gc/20-observability-prometheus.md) |
| [`common/src/main/kotlin/com/kgd/common/jackson/CommonJacksonAutoConfiguration.kt`](../../common/src/main/kotlin/com/kgd/common/jackson/CommonJacksonAutoConfiguration.kt) | `code-jvm` | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md), [17-spring-web/09-jackson-objectmapper.md](17-spring-web/09-jackson-objectmapper.md), [17-spring-web/18-msa-common-patterns.md](17-spring-web/18-msa-common-patterns.md) |
| `common/src/main/kotlin/com/kgd/common/datasource/CommonDataSourceAutoConfiguration.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md), [15-connection-pool/17-improvements.md](15-connection-pool/17-improvements.md) |
| `common/src/main/kotlin/com/kgd/common/datasource/Stickiness.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md), [15-connection-pool/17-improvements.md](15-connection-pool/17-improvements.md) |
| `common/src/main/kotlin/com/kgd/common/messaging/IdempotentEventHandler.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md), [7-distributed-systems/19-improvements.md](7-distributed-systems/19-improvements.md) |
| [`common/src/main/kotlin/com/kgd/common/security/AesUtil.kt`](../../common/src/main/kotlin/com/kgd/common/security/AesUtil.kt) | `code-jvm` | [13-crypto-jwt-sso/00-plan.md](13-crypto-jwt-sso/00-plan.md), [13-crypto-jwt-sso/02-aes-modes.md](13-crypto-jwt-sso/02-aes-modes.md) |
| `common/src/main/kotlin/com/kgd/common/web/TraceIdFilter.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [17-spring-web/18-msa-common-patterns.md](17-spring-web/18-msa-common-patterns.md), [17-spring-web/19-improvements.md](17-spring-web/19-improvements.md) |
| `common/CommonRedisAutoConfiguration.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [9-redis-deep-dive/09-cluster-slots.md](9-redis-deep-dive/09-cluster-slots.md) |
| `common/application-actuator.yml` <sub>(미존재/축약)</sub> | `config` | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md) |
| `common/application.yml` <sub>(미존재/축약)</sub> | `config` | [10-observability/13-improvements.md](10-observability/13-improvements.md) |
| `common/datasource/Stickiness.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [00-INDEX.md](00-INDEX.md) |
| `common/exception/BusinessException.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [5-spring-transactional/02-default-rollback-rules.md](5-spring-transactional/02-default-rollback-rules.md) |
| `common/kafka/IdempotentEventHandler.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [6-kafka-internals/13-improvements.md](6-kafka-internals/13-improvements.md) |
| `common/security/JwtUtil.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [00-INDEX.md](00-INDEX.md) |
| `common/src/main/kotlin/com/kgd/common/cache/StampedeGuardedCache.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md) |
| `common/src/main/kotlin/com/kgd/common/cache/TtlJitter.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md) |
| `common/src/main/kotlin/com/kgd/common/datasource/RoutingDataSource.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md) |
| `common/src/main/kotlin/com/kgd/common/datasource/WriteEvent.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md) |
| [`common/src/main/kotlin/com/kgd/common/exception/ErrorCode.kt`](../../common/src/main/kotlin/com/kgd/common/exception/ErrorCode.kt) | `code-jvm` | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md) |
| `common/src/main/kotlin/com/kgd/common/lock/DistributedLock.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md) |
| `common/src/main/kotlin/com/kgd/common/messaging/ProcessedEventRepositoryPort.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md) |
| `common/src/main/kotlin/com/kgd/common/observability/TraceIdFilter.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md) |
| [`common/src/main/kotlin/com/kgd/common/security/CommonSecurityAutoConfiguration.kt`](../../common/src/main/kotlin/com/kgd/common/security/CommonSecurityAutoConfiguration.kt) | `code-jvm` | [13-crypto-jwt-sso/00-plan.md](13-crypto-jwt-sso/00-plan.md) |
| [`common/src/main/kotlin/com/kgd/common/security/JwtProperties.kt`](../../common/src/main/kotlin/com/kgd/common/security/JwtProperties.kt) | `code-jvm` | [13-crypto-jwt-sso/00-plan.md](13-crypto-jwt-sso/00-plan.md) |
| [`common/src/main/kotlin/com/kgd/common/security/JwtUtil.kt`](../../common/src/main/kotlin/com/kgd/common/security/JwtUtil.kt) | `code-jvm` | [13-crypto-jwt-sso/00-plan.md](13-crypto-jwt-sso/00-plan.md) |
| `common/src/main/kotlin/com/kgd/common/web/ApiResponseAdvice.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [17-spring-web/18-msa-common-patterns.md](17-spring-web/18-msa-common-patterns.md) |
| `common/src/main/kotlin/com/kgd/common/web/IdempotencyAspect.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md) |
| `common/src/main/kotlin/com/kgd/common/web/Idempotent.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md) |
| [`common/src/main/kotlin/com/kgd/common/webclient/CommonWebClientAutoConfiguration.kt`](../../common/src/main/kotlin/com/kgd/common/webclient/CommonWebClientAutoConfiguration.kt) | `code-jvm` | [16-async-nonblocking-io/17-http-client-tradeoffs.md](16-async-nonblocking-io/17-http-client-tradeoffs.md) |
| `common/src/main/resources/application-actuator.yml` <sub>(미존재/축약)</sub> | `config` | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md) |
| `common/src/main/resources/application.yml` <sub>(미존재/축약)</sub> | `config` | [10-observability/13-improvements.md](10-observability/13-improvements.md) |
| [`common/src/test/kotlin/com/kgd/common/security/AesUtilTest.kt`](../../common/src/test/kotlin/com/kgd/common/security/AesUtilTest.kt) | `code-jvm` | [13-crypto-jwt-sso/00-plan.md](13-crypto-jwt-sso/00-plan.md) |

### gateway

_총 23 개 경로, 49 건 인용_

_Kind 분포_: `code-jvm`=14 / `config`=7 / `gradle`=1 / `svc-claude`=1

| Path | Kind | 인용 학습 노트 |
|---|---|---|
| `gateway/ingress.yaml` <sub>(미존재/축약)</sub> | `config` | [1-aws-network/09-alb.md](1-aws-network/09-alb.md), [1-aws-network/13-eks-networking.md](1-aws-network/13-eks-networking.md), [1-aws-network/17-msa-mapping.md](1-aws-network/17-msa-mapping.md), [11-k8s-deep-dive/06-ingress-gateway-api.md](11-k8s-deep-dive/06-ingress-gateway-api.md), [17-spring-web/01-http-pipeline.md](17-spring-web/01-http-pipeline.md), [17-spring-web/14-gzip-layers.md](17-spring-web/14-gzip-layers.md) |
| [`gateway/src/main/kotlin/com/kgd/gateway/config/RateLimiterConfig.kt`](../../gateway/src/main/kotlin/com/kgd/gateway/config/RateLimiterConfig.kt) | `code-jvm` | [17-spring-web/17-msa-gateway-filter.md](17-spring-web/17-msa-gateway-filter.md), [7-distributed-systems/12-bulkhead-ratelimit.md](7-distributed-systems/12-bulkhead-ratelimit.md), [8-system-design/06-rate-limiter.md](8-system-design/06-rate-limiter.md), [9-redis-deep-dive/17-msa-application.md](9-redis-deep-dive/17-msa-application.md) |
| [`gateway/src/main/kotlin/com/kgd/gateway/filter/AuthenticationGatewayFilter.kt`](../../gateway/src/main/kotlin/com/kgd/gateway/filter/AuthenticationGatewayFilter.kt) | `code-jvm` | [13-crypto-jwt-sso/00-plan.md](13-crypto-jwt-sso/00-plan.md), [16-async-nonblocking-io/15-msa-gateway-webflux.md](16-async-nonblocking-io/15-msa-gateway-webflux.md), [17-spring-web/02-filter-vs-interceptor-vs-aop.md](17-spring-web/02-filter-vs-interceptor-vs-aop.md), [17-spring-web/17-msa-gateway-filter.md](17-spring-web/17-msa-gateway-filter.md) |
| `gateway/application.yml` <sub>(미존재/축약)</sub> | `config` | [15-connection-pool/13-reactive-r2dbc.md](15-connection-pool/13-reactive-r2dbc.md), [15-connection-pool/15-codebase-audit.md](15-connection-pool/15-codebase-audit.md), [15-connection-pool/18-interview-qa.md](15-connection-pool/18-interview-qa.md) |
| [`gateway/build.gradle.kts`](../../gateway/build.gradle.kts) | `gradle` | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md), [16-async-nonblocking-io/18-improvements.md](16-async-nonblocking-io/18-improvements.md), [2-jvm-gc/21-improvements.md](2-jvm-gc/21-improvements.md) |
| [`gateway/src/main/resources/application.yml`](../../gateway/src/main/resources/application.yml) | `config` | [15-connection-pool/13-reactive-r2dbc.md](15-connection-pool/13-reactive-r2dbc.md), [15-connection-pool/15-codebase-audit.md](15-connection-pool/15-codebase-audit.md), [15-connection-pool/18-interview-qa.md](15-connection-pool/18-interview-qa.md) |
| [`gateway/CLAUDE.md`](../../gateway/CLAUDE.md) | `svc-claude` | [16-async-nonblocking-io/12-webflux-vs-mvc.md](16-async-nonblocking-io/12-webflux-vs-mvc.md), [16-async-nonblocking-io/15-msa-gateway-webflux.md](16-async-nonblocking-io/15-msa-gateway-webflux.md) |
| `gateway/RateLimiterConfig.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [8-system-design/00-preview.md](8-system-design/00-preview.md), [8-system-design/06-rate-limiter.md](8-system-design/06-rate-limiter.md) |
| `gateway/app/src/main/resources/application.yml` <sub>(미존재/축약)</sub> | `config` | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md), [15-connection-pool/00-plan.md](15-connection-pool/00-plan.md) |
| `gateway/deployment.yaml` <sub>(미존재/축약)</sub> | `config` | [11-k8s-deep-dive/02-core-resources.md](11-k8s-deep-dive/02-core-resources.md), [11-k8s-deep-dive/15-msa-k8s-grep.md](11-k8s-deep-dive/15-msa-k8s-grep.md) |
| `gateway/ingress-private.yaml` <sub>(미존재/축약)</sub> | `config` | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md), [17-spring-web/19-improvements.md](17-spring-web/19-improvements.md) |
| [`gateway/src/main/kotlin/com/kgd/gateway/config/GatewayRouteConfig.kt`](../../gateway/src/main/kotlin/com/kgd/gateway/config/GatewayRouteConfig.kt) | `code-jvm` | [16-async-nonblocking-io/15-msa-gateway-webflux.md](16-async-nonblocking-io/15-msa-gateway-webflux.md), [7-distributed-systems/12-bulkhead-ratelimit.md](7-distributed-systems/12-bulkhead-ratelimit.md) |
| [`gateway/src/main/kotlin/com/kgd/gateway/config/SecurityConfig.kt`](../../gateway/src/main/kotlin/com/kgd/gateway/config/SecurityConfig.kt) | `code-jvm` | [17-spring-web/06-security-filter-chain.md](17-spring-web/06-security-filter-chain.md), [17-spring-web/17-msa-gateway-filter.md](17-spring-web/17-msa-gateway-filter.md) |
| [`gateway/src/main/kotlin/com/kgd/gateway/filter/RequestLoggingFilter.kt`](../../gateway/src/main/kotlin/com/kgd/gateway/filter/RequestLoggingFilter.kt) | `code-jvm` | [17-spring-web/02-filter-vs-interceptor-vs-aop.md](17-spring-web/02-filter-vs-interceptor-vs-aop.md), [17-spring-web/17-msa-gateway-filter.md](17-spring-web/17-msa-gateway-filter.md) |
| [`gateway/src/main/kotlin/com/kgd/gateway/filter/VisitorIdFilter.kt`](../../gateway/src/main/kotlin/com/kgd/gateway/filter/VisitorIdFilter.kt) | `code-jvm` | [17-spring-web/02-filter-vs-interceptor-vs-aop.md](17-spring-web/02-filter-vs-interceptor-vs-aop.md), [17-spring-web/17-msa-gateway-filter.md](17-spring-web/17-msa-gateway-filter.md) |
| `gateway/app/src/main/kotlin/com/kgd/gateway/config/RateLimiterConfig.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md) |
| `gateway/app/src/main/kotlin/com/kgd/gateway/config/RouteConfig.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md) |
| `gateway/app/src/main/kotlin/com/kgd/gateway/filter/TieredRateLimiter.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md) |
| `gateway/app/src/main/kotlin/com/kgd/gateway/web/FallbackController.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md) |
| `gateway/rollout.yaml` <sub>(미존재/축약)</sub> | `config` | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md) |
| [`gateway/src/main/kotlin/com/kgd/gateway/config/RedisConfig.kt`](../../gateway/src/main/kotlin/com/kgd/gateway/config/RedisConfig.kt) | `code-jvm` | [16-async-nonblocking-io/15-msa-gateway-webflux.md](16-async-nonblocking-io/15-msa-gateway-webflux.md) |
| `gateway/src/main/kotlin/com/kgd/gateway/filter/TraceIdFilter.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [17-spring-web/19-improvements.md](17-spring-web/19-improvements.md) |
| [`gateway/src/main/kotlin/com/kgd/gateway/security/JwtTokenValidator.kt`](../../gateway/src/main/kotlin/com/kgd/gateway/security/JwtTokenValidator.kt) | `code-jvm` | [13-crypto-jwt-sso/00-plan.md](13-crypto-jwt-sso/00-plan.md) |

### quant

_총 17 개 경로, 27 건 인용_

_Kind 분포_: `code-jvm`=14 / `svc-claude`=1 / `gradle`=1 / `config`=1

| Path | Kind | 인용 학습 노트 |
|---|---|---|
| `quant/BithumbWebSocketSubscriber.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [3-java-kotlin-concurrency/07-executor-threadpool.md](3-java-kotlin-concurrency/07-executor-threadpool.md), [3-java-kotlin-concurrency/09-jmm-happens-before.md](3-java-kotlin-concurrency/09-jmm-happens-before.md), [3-java-kotlin-concurrency/16-structured-concurrency.md](3-java-kotlin-concurrency/16-structured-concurrency.md), [3-java-kotlin-concurrency/22-msa-concurrency-patterns.md](3-java-kotlin-concurrency/22-msa-concurrency-patterns.md) |
| `quant/NotificationDispatcher.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [3-java-kotlin-concurrency/07-executor-threadpool.md](3-java-kotlin-concurrency/07-executor-threadpool.md), [3-java-kotlin-concurrency/14-coroutine-internals.md](3-java-kotlin-concurrency/14-coroutine-internals.md), [3-java-kotlin-concurrency/16-structured-concurrency.md](3-java-kotlin-concurrency/16-structured-concurrency.md), [3-java-kotlin-concurrency/22-msa-concurrency-patterns.md](3-java-kotlin-concurrency/22-msa-concurrency-patterns.md) |
| `quant/MarketDataHub.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [3-java-kotlin-concurrency/08-concurrent-collections.md](3-java-kotlin-concurrency/08-concurrent-collections.md), [3-java-kotlin-concurrency/15-flow-channel.md](3-java-kotlin-concurrency/15-flow-channel.md), [3-java-kotlin-concurrency/22-msa-concurrency-patterns.md](3-java-kotlin-concurrency/22-msa-concurrency-patterns.md) |
| `quant/OutboxRelay.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [3-java-kotlin-concurrency/03-volatile-memory-visibility.md](3-java-kotlin-concurrency/03-volatile-memory-visibility.md), [3-java-kotlin-concurrency/22-msa-concurrency-patterns.md](3-java-kotlin-concurrency/22-msa-concurrency-patterns.md) |
| `quant/QuantMetrics.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [3-java-kotlin-concurrency/08-concurrent-collections.md](3-java-kotlin-concurrency/08-concurrent-collections.md), [3-java-kotlin-concurrency/22-msa-concurrency-patterns.md](3-java-kotlin-concurrency/22-msa-concurrency-patterns.md) |
| `quant/AuditChainVerifier.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [3-java-kotlin-concurrency/22-msa-concurrency-patterns.md](3-java-kotlin-concurrency/22-msa-concurrency-patterns.md) |
| `quant/BithumbRestFallbackPoller.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [3-java-kotlin-concurrency/22-msa-concurrency-patterns.md](3-java-kotlin-concurrency/22-msa-concurrency-patterns.md) |
| [`quant/CLAUDE.md`](../../quant/CLAUDE.md) | `svc-claude` | [15-connection-pool/13-reactive-r2dbc.md](15-connection-pool/13-reactive-r2dbc.md) |
| `quant/ClickHouseAuditLogPublisher.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [3-java-kotlin-concurrency/14-coroutine-internals.md](3-java-kotlin-concurrency/14-coroutine-internals.md) |
| `quant/ExchangeCredentialEntity.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [3-java-kotlin-concurrency/22-msa-concurrency-patterns.md](3-java-kotlin-concurrency/22-msa-concurrency-patterns.md) |
| `quant/LazyReencryptionJob.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [3-java-kotlin-concurrency/22-msa-concurrency-patterns.md](3-java-kotlin-concurrency/22-msa-concurrency-patterns.md) |
| `quant/MarketTickKafkaCollector.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [3-java-kotlin-concurrency/15-flow-channel.md](3-java-kotlin-concurrency/15-flow-channel.md) |
| `quant/OutboxPendingMetric.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [3-java-kotlin-concurrency/22-msa-concurrency-patterns.md](3-java-kotlin-concurrency/22-msa-concurrency-patterns.md) |
| [`quant/app/build.gradle.kts`](../../quant/app/build.gradle.kts) | `gradle` | [2-jvm-gc/07-zgc-deep.md](2-jvm-gc/07-zgc-deep.md) |
| [`quant/app/src/main/kotlin/com/kgd/quant/infrastructure/metrics/QuantMetrics.kt`](../../quant/app/src/main/kotlin/com/kgd/quant/infrastructure/metrics/QuantMetrics.kt) | `code-jvm` | [10-observability/12-msa-current-state.md](10-observability/12-msa-current-state.md) |
| [`quant/app/src/main/kotlin/com/kgd/quant/infrastructure/resilience/RedisTokenBucketRateLimiter.kt`](../../quant/app/src/main/kotlin/com/kgd/quant/infrastructure/resilience/RedisTokenBucketRateLimiter.kt) | `code-jvm` | [9-redis-deep-dive/17-msa-application.md](9-redis-deep-dive/17-msa-application.md) |
| `quant/deployment.yaml` <sub>(미존재/축약)</sub> | `config` | [2-jvm-gc/18-msa-jib-config.md](2-jvm-gc/18-msa-jib-config.md) |

### order

_총 13 개 경로, 20 건 인용_

_Kind 분포_: `code-jvm`=9 / `config`=2 / `gradle`=1 / `sql`=1

| Path | Kind | 인용 학습 노트 |
|---|---|---|
| [`order/app/src/main/resources/application.yml`](../../order/app/src/main/resources/application.yml) | `config` | [15-connection-pool/16-pool-exhaustion-drill.md](15-connection-pool/16-pool-exhaustion-drill.md), [3-java-kotlin-concurrency/17-virtual-threads.md](3-java-kotlin-concurrency/17-virtual-threads.md), [6-kafka-internals/11-msa-codebase-grep.md](6-kafka-internals/11-msa-codebase-grep.md) |
| `order/KafkaConfig.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [16-async-nonblocking-io/16-lettuce-kafka-nio.md](16-async-nonblocking-io/16-lettuce-kafka-nio.md), [3-java-kotlin-concurrency/22-msa-concurrency-patterns.md](3-java-kotlin-concurrency/22-msa-concurrency-patterns.md) |
| `order/ProductAdapter.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [16-async-nonblocking-io/10-project-reactor.md](16-async-nonblocking-io/10-project-reactor.md), [16-async-nonblocking-io/18-improvements.md](16-async-nonblocking-io/18-improvements.md) |
| `order/WebClientConfig.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [16-async-nonblocking-io/17-http-client-tradeoffs.md](16-async-nonblocking-io/17-http-client-tradeoffs.md), [7-distributed-systems/11-circuit-breaker.md](7-distributed-systems/11-circuit-breaker.md) |
| [`order/app/build.gradle.kts`](../../order/app/build.gradle.kts) | `gradle` | [18-grpc/17-proto-monorepo-strategy.md](18-grpc/17-proto-monorepo-strategy.md), [18-grpc/18-virtual-migration-product.md](18-grpc/18-virtual-migration-product.md) |
| [`order/app/src/main/kotlin/com/kgd/order/client/ProductAdapter.kt`](../../order/app/src/main/kotlin/com/kgd/order/client/ProductAdapter.kt) | `code-jvm` | [16-async-nonblocking-io/14-coroutine-vs-reactor.md](16-async-nonblocking-io/14-coroutine-vs-reactor.md), [16-async-nonblocking-io/17-http-client-tradeoffs.md](16-async-nonblocking-io/17-http-client-tradeoffs.md) |
| `order/PaymentAdapter.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [7-distributed-systems/01-distributed-fundamentals.md](7-distributed-systems/01-distributed-fundamentals.md) |
| `order/V1__create_orders_table.sql` <sub>(미존재/축약)</sub> | `sql` | [4-db-index-transaction/03-clustered-vs-secondary.md](4-db-index-transaction/03-clustered-vs-secondary.md) |
| `order/app/...IdempotentEventListener.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [00-LEARNING-GUIDE.md](00-LEARNING-GUIDE.md) |
| `order/app/src/main/kotlin/com/kgd/order/infrastructure/client/ProductAdapter.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [18-grpc/18-virtual-migration-product.md](18-grpc/18-virtual-migration-product.md) |
| `order/app/src/main/kotlin/com/kgd/order/infrastructure/config/KafkaConfig.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [6-kafka-internals/11-msa-codebase-grep.md](6-kafka-internals/11-msa-codebase-grep.md) |
| `order/messaging/OrderEventConsumer.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [16-async-nonblocking-io/16-lettuce-kafka-nio.md](16-async-nonblocking-io/16-lettuce-kafka-nio.md) |
| `order/rollout.yaml` <sub>(미존재/축약)</sub> | `config` | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md) |

### product

_총 8 개 경로, 17 건 인용_

_Kind 분포_: `code-jvm`=4 / `config`=2 / `gradle`=1 / `sql`=1

| Path | Kind | 인용 학습 노트 |
|---|---|---|
| [`product/app/src/main/kotlin/com/kgd/product/config/DataSourceConfig.kt`](../../product/app/src/main/kotlin/com/kgd/product/config/DataSourceConfig.kt) | `code-jvm` | [15-connection-pool/00-preview.md](15-connection-pool/00-preview.md), [15-connection-pool/03-spring-boot-defaults.md](15-connection-pool/03-spring-boot-defaults.md), [15-connection-pool/09-reader-writer-routing.md](15-connection-pool/09-reader-writer-routing.md), [15-connection-pool/15-codebase-audit.md](15-connection-pool/15-codebase-audit.md), [15-connection-pool/17-improvements.md](15-connection-pool/17-improvements.md), [15-connection-pool/18-interview-qa.md](15-connection-pool/18-interview-qa.md) |
| [`product/app/build.gradle.kts`](../../product/app/build.gradle.kts) | `gradle` | [10-observability/02-prometheus-pull-model.md](10-observability/02-prometheus-pull-model.md), [10-observability/08-opentelemetry-tracing.md](10-observability/08-opentelemetry-tracing.md), [18-grpc/18-virtual-migration-product.md](18-grpc/18-virtual-migration-product.md), [2-jvm-gc/20-observability-prometheus.md](2-jvm-gc/20-observability-prometheus.md) |
| [`product/app/src/main/resources/application.yml`](../../product/app/src/main/resources/application.yml) | `config` | [10-observability/02-prometheus-pull-model.md](10-observability/02-prometheus-pull-model.md), [10-observability/12-msa-current-state.md](10-observability/12-msa-current-state.md) |
| `product/DataSourceConfig.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [15-connection-pool/09-reader-writer-routing.md](15-connection-pool/09-reader-writer-routing.md) |
| `product/V1__create_products_table.sql` <sub>(미존재/축약)</sub> | `sql` | [4-db-index-transaction/03-clustered-vs-secondary.md](4-db-index-transaction/03-clustered-vs-secondary.md) |
| `product/app/src/main/kotlin/com/kgd/product/infrastructure/config/DataSourceConfig.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [5-spring-transactional/07-replica-routing-pattern.md](5-spring-transactional/07-replica-routing-pattern.md) |
| `product/app/src/main/kotlin/com/kgd/product/lab/LabLeakController.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [2-jvm-gc/15-lab-heap-dump-mat.md](2-jvm-gc/15-lab-heap-dump-mat.md) |
| `product/deployment.yaml` <sub>(미존재/축약)</sub> | `config` | [2-jvm-gc/19-k8s-memory-vs-heap.md](2-jvm-gc/19-k8s-memory-vs-heap.md) |

### inventory

_총 10 개 경로, 11 건 인용_

| Path | Kind | 인용 학습 노트 |
|---|---|---|
| `inventory/InventoryEventConsumer.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [7-distributed-systems/09-idempotency.md](7-distributed-systems/09-idempotency.md), [7-distributed-systems/17-codebase-idempotent-ssot.md](7-distributed-systems/17-codebase-idempotent-ssot.md) |
| `inventory/InventoryJpaEntity.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [3-java-kotlin-concurrency/22-msa-concurrency-patterns.md](3-java-kotlin-concurrency/22-msa-concurrency-patterns.md) |
| `inventory/InventoryReconciliationService.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [3-java-kotlin-concurrency/22-msa-concurrency-patterns.md](3-java-kotlin-concurrency/22-msa-concurrency-patterns.md) |
| `inventory/OutboxPollingPublisher.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [3-java-kotlin-concurrency/22-msa-concurrency-patterns.md](3-java-kotlin-concurrency/22-msa-concurrency-patterns.md) |
| `inventory/ReservationExpiryService.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [3-java-kotlin-concurrency/22-msa-concurrency-patterns.md](3-java-kotlin-concurrency/22-msa-concurrency-patterns.md) |
| [`inventory/app/src/main/kotlin/com/kgd/inventory/infrastructure/config/KafkaConfig.kt`](../../inventory/app/src/main/kotlin/com/kgd/inventory/infrastructure/config/KafkaConfig.kt) | `code-jvm` | [6-kafka-internals/11-msa-codebase-grep.md](6-kafka-internals/11-msa-codebase-grep.md) |
| `inventory/app/src/main/kotlin/com/kgd/inventory/inventory/persistence/InventoryJpaEntity.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md) |
| `inventory/app/src/main/kotlin/com/kgd/inventory/inventory/persistence/InventoryJpaRepository.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md) |
| `inventory/app/src/main/kotlin/com/kgd/inventory/inventory/service/ReservationService.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md) |
| `inventory/service/InventoryService.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [7-distributed-systems/16-codebase-saga.md](7-distributed-systems/16-codebase-saga.md) |

### analytics

_총 2 개 경로, 5 건 인용_

| Path | Kind | 인용 학습 노트 |
|---|---|---|
| `analytics/EventIngestionConsumer.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [3-java-kotlin-concurrency/02-synchronized-monitor.md](3-java-kotlin-concurrency/02-synchronized-monitor.md), [3-java-kotlin-concurrency/21-profiling-tools.md](3-java-kotlin-concurrency/21-profiling-tools.md), [3-java-kotlin-concurrency/22-msa-concurrency-patterns.md](3-java-kotlin-concurrency/22-msa-concurrency-patterns.md) |
| `analytics/ScoreCacheAdapter.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md), [9-redis-deep-dive/18-improvements.md](9-redis-deep-dive/18-improvements.md) |

### auth

_총 1 개 경로, 4 건 인용_

| Path | Kind | 인용 학습 노트 |
|---|---|---|
| `auth/AuthService.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md), [3-java-kotlin-concurrency/08-concurrent-collections.md](3-java-kotlin-concurrency/08-concurrent-collections.md), [3-java-kotlin-concurrency/22-msa-concurrency-patterns.md](3-java-kotlin-concurrency/22-msa-concurrency-patterns.md), [3-java-kotlin-concurrency/23-improvements.md](3-java-kotlin-concurrency/23-improvements.md) |

### fulfillment

_총 2 개 경로, 3 건 인용_

| Path | Kind | 인용 학습 노트 |
|---|---|---|
| `fulfillment/OutboxPollingPublisher.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [3-java-kotlin-concurrency/22-msa-concurrency-patterns.md](3-java-kotlin-concurrency/22-msa-concurrency-patterns.md), [7-distributed-systems/14-outbox-inbox-cdc.md](7-distributed-systems/14-outbox-inbox-cdc.md) |
| `fulfillment/service/FulfillmentService.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [7-distributed-systems/16-codebase-saga.md](7-distributed-systems/16-codebase-saga.md) |

### agent-viewer

_총 2 개 경로, 2 건 인용_

| Path | Kind | 인용 학습 노트 |
|---|---|---|
| `agent-viewer/InMemoryStateStore.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [3-java-kotlin-concurrency/22-msa-concurrency-patterns.md](3-java-kotlin-concurrency/22-msa-concurrency-patterns.md) |
| [`agent-viewer/api/src/main/kotlin/com/kgd/agentviewer/config/JacksonConfig.kt`](../../agent-viewer/api/src/main/kotlin/com/kgd/agentviewer/config/JacksonConfig.kt) | `code-jvm` | [17-spring-web/09-jackson-objectmapper.md](17-spring-web/09-jackson-objectmapper.md) |

### gifticon

_총 1 개 경로, 2 건 인용_

| Path | Kind | 인용 학습 노트 |
|---|---|---|
| `gifticon/ExpiryCheckScheduler.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [3-java-kotlin-concurrency/07-executor-threadpool.md](3-java-kotlin-concurrency/07-executor-threadpool.md), [3-java-kotlin-concurrency/22-msa-concurrency-patterns.md](3-java-kotlin-concurrency/22-msa-concurrency-patterns.md) |

### chatbot

_총 1 개 경로, 1 건 인용_

| Path | Kind | 인용 학습 노트 |
|---|---|---|
| [`chatbot/app/src/main/kotlin/com/kgd/chatbot/infrastructure/ai/ClaudeApiAdapter.kt`](../../chatbot/app/src/main/kotlin/com/kgd/chatbot/infrastructure/ai/ClaudeApiAdapter.kt) | `code-jvm` | [16-async-nonblocking-io/17-http-client-tradeoffs.md](16-async-nonblocking-io/17-http-client-tradeoffs.md) |

### ai

_총 1 개 경로, 1 건 인용_

| Path | Kind | 인용 학습 노트 |
|---|---|---|
| `ai/ClaudeApiAdapter.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [16-async-nonblocking-io/17-http-client-tradeoffs.md](16-async-nonblocking-io/17-http-client-tradeoffs.md) |

### search

_총 1 개 경로, 1 건 인용_

| Path | Kind | 인용 학습 노트 |
|---|---|---|
| `search/EsBulkDocumentProcessor.kt` <sub>(미존재/축약)</sub> | `code-jvm` | [3-java-kotlin-concurrency/22-msa-concurrency-patterns.md](3-java-kotlin-concurrency/22-msa-concurrency-patterns.md) |

---

## §2.5 Infra & Build

플랫폼 인프라/빌드 자산 별 인용. 클러스터 / 빌드 변경 시 영향 노트 식별.

### K8s manifests (k8s/)

_총 45 개 경로, 86 건 인용_

| Path | 인용 수 | 인용 학습 노트 |
|---|---:|---|
| [`k8s/infra/prod/monitoring/servicemonitor-apps.yaml`](../../k8s/infra/prod/monitoring/servicemonitor-apps.yaml) | 8 | [10-observability/01-observability-foundations.md](10-observability/01-observability-foundations.md), [10-observability/02-prometheus-pull-model.md](10-observability/02-prometheus-pull-model.md), [10-observability/12-msa-current-state.md](10-observability/12-msa-current-state.md), [10-observability/14-interview-qa.md](10-observability/14-interview-qa.md), [11-k8s-deep-dive/02-core-resources.md](11-k8s-deep-dive/02-core-resources.md), [11-k8s-deep-dive/09-autoscaling.md](11-k8s-deep-dive/09-autoscaling.md), [11-k8s-deep-dive/15-msa-k8s-grep.md](11-k8s-deep-dive/15-msa-k8s-grep.md), [2-jvm-gc/20-observability-prometheus.md](2-jvm-gc/20-observability-prometheus.md) |
| [`k8s/infra/local/redis/statefulset.yaml`](../../k8s/infra/local/redis/statefulset.yaml) | 7 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md), [11-k8s-deep-dive/07-storage.md](11-k8s-deep-dive/07-storage.md), [9-redis-deep-dive/05-ttl-and-eviction.md](9-redis-deep-dive/05-ttl-and-eviction.md), [9-redis-deep-dive/06-rdb-persistence.md](9-redis-deep-dive/06-rdb-persistence.md), [9-redis-deep-dive/07-aof-persistence.md](9-redis-deep-dive/07-aof-persistence.md), [9-redis-deep-dive/16-memory-and-pitfalls.md](9-redis-deep-dive/16-memory-and-pitfalls.md), [9-redis-deep-dive/18-improvements.md](9-redis-deep-dive/18-improvements.md) |
| [`k8s/base/gateway/ingress.yaml`](../../k8s/base/gateway/ingress.yaml) | 6 | [1-aws-network/09-alb.md](1-aws-network/09-alb.md), [1-aws-network/13-eks-networking.md](1-aws-network/13-eks-networking.md), [1-aws-network/17-msa-mapping.md](1-aws-network/17-msa-mapping.md), [11-k8s-deep-dive/06-ingress-gateway-api.md](11-k8s-deep-dive/06-ingress-gateway-api.md), [17-spring-web/01-http-pipeline.md](17-spring-web/01-http-pipeline.md), [17-spring-web/14-gzip-layers.md](17-spring-web/14-gzip-layers.md) |
| [`k8s/infra/prod/redis/values.yaml`](../../k8s/infra/prod/redis/values.yaml) | 6 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md), [9-redis-deep-dive/00-preview.md](9-redis-deep-dive/00-preview.md), [9-redis-deep-dive/07-aof-persistence.md](9-redis-deep-dive/07-aof-persistence.md), [9-redis-deep-dive/09-cluster-slots.md](9-redis-deep-dive/09-cluster-slots.md), [9-redis-deep-dive/17-msa-application.md](9-redis-deep-dive/17-msa-application.md), [9-redis-deep-dive/18-improvements.md](9-redis-deep-dive/18-improvements.md) |
| `k8s/infra/local/ingress-nginx/values.yaml` <sub>(미존재/축약)</sub> | 4 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md), [17-spring-web/14-gzip-layers.md](17-spring-web/14-gzip-layers.md), [17-spring-web/18-msa-common-patterns.md](17-spring-web/18-msa-common-patterns.md), [17-spring-web/19-improvements.md](17-spring-web/19-improvements.md) |
| [`k8s/infra/prod/strimzi/kafka-cluster.yaml`](../../k8s/infra/prod/strimzi/kafka-cluster.yaml) | 4 | [11-k8s-deep-dive/15-msa-k8s-grep.md](11-k8s-deep-dive/15-msa-k8s-grep.md), [6-kafka-internals/03-controller-kraft.md](6-kafka-internals/03-controller-kraft.md), [6-kafka-internals/06-replication-isr.md](6-kafka-internals/06-replication-isr.md), [6-kafka-internals/11-msa-codebase-grep.md](6-kafka-internals/11-msa-codebase-grep.md) |
| [`k8s/infra/prod/strimzi/kafka-topics.yaml`](../../k8s/infra/prod/strimzi/kafka-topics.yaml) | 3 | [6-kafka-internals/01-broker-topic-partition.md](6-kafka-internals/01-broker-topic-partition.md), [6-kafka-internals/06-replication-isr.md](6-kafka-internals/06-replication-isr.md), [6-kafka-internals/11-msa-codebase-grep.md](6-kafka-internals/11-msa-codebase-grep.md) |
| [`k8s/base/frontend-ingress.yaml`](../../k8s/base/frontend-ingress.yaml) | 2 | [00-INDEX.md](00-INDEX.md), [1-aws-network/00-plan.md](1-aws-network/00-plan.md) |
| [`k8s/base/gateway/deployment.yaml`](../../k8s/base/gateway/deployment.yaml) | 2 | [11-k8s-deep-dive/02-core-resources.md](11-k8s-deep-dive/02-core-resources.md), [11-k8s-deep-dive/15-msa-k8s-grep.md](11-k8s-deep-dive/15-msa-k8s-grep.md) |
| `k8s/base/gateway/ingress-private.yaml` <sub>(미존재/축약)</sub> | 2 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md), [17-spring-web/19-improvements.md](17-spring-web/19-improvements.md) |
| `k8s/base/namespace-pss.yaml` <sub>(미존재/축약)</sub> | 2 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md), [11-k8s-deep-dive/16-improvements.md](11-k8s-deep-dive/16-improvements.md) |
| `k8s/base/network-policy/default-deny.yaml` <sub>(미존재/축약)</sub> | 2 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md), [11-k8s-deep-dive/16-improvements.md](11-k8s-deep-dive/16-improvements.md) |
| [`k8s/infra/local/kafka/statefulset.yaml`](../../k8s/infra/local/kafka/statefulset.yaml) | 2 | [6-kafka-internals/03-controller-kraft.md](6-kafka-internals/03-controller-kraft.md), [6-kafka-internals/11-msa-codebase-grep.md](6-kafka-internals/11-msa-codebase-grep.md) |
| `k8s/infra/prod/monitoring/jvm-alerts.yaml` <sub>(미존재/축약)</sub> | 2 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md), [2-jvm-gc/21-improvements.md](2-jvm-gc/21-improvements.md) |
| [`k8s/infra/prod/monitoring/values.yaml`](../../k8s/infra/prod/monitoring/values.yaml) | 2 | [10-observability/01-observability-foundations.md](10-observability/01-observability-foundations.md), [10-observability/12-msa-current-state.md](10-observability/12-msa-current-state.md) |
| [`k8s/overlays/k3s-lite/patches/redis-standalone-product.yaml`](../../k8s/overlays/k3s-lite/patches/redis-standalone-product.yaml) | 2 | [9-redis-deep-dive/09-cluster-slots.md](9-redis-deep-dive/09-cluster-slots.md), [9-redis-deep-dive/17-msa-application.md](9-redis-deep-dive/17-msa-application.md) |
| `k8s/overlays/prod-k8s/patches/topology-spread.yaml` <sub>(미존재/축약)</sub> | 2 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md), [11-k8s-deep-dive/16-improvements.md](11-k8s-deep-dive/16-improvements.md) |
| [`k8s/base/product/deployment.yaml`](../../k8s/base/product/deployment.yaml) | 1 | [2-jvm-gc/19-k8s-memory-vs-heap.md](2-jvm-gc/19-k8s-memory-vs-heap.md) |
| [`k8s/base/quant/deployment.yaml`](../../k8s/base/quant/deployment.yaml) | 1 | [2-jvm-gc/18-msa-jib-config.md](2-jvm-gc/18-msa-jib-config.md) |
| `k8s/hpa.yaml` <sub>(미존재/축약)</sub> | 1 | [11-k8s-deep-dive/09-autoscaling.md](11-k8s-deep-dive/09-autoscaling.md) |
| `k8s/infra/prod/argo-rollouts/analysis-templates/latency-p99.yaml` <sub>(미존재/축약)</sub> | 1 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md) |
| `k8s/infra/prod/argo-rollouts/analysis-templates/success-rate.yaml` <sub>(미존재/축약)</sub> | 1 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md) |
| `k8s/infra/prod/argocd/values.yaml` <sub>(미존재/축약)</sub> | 1 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md) |
| [`k8s/infra/prod/backup/cronjob-full.yaml`](../../k8s/infra/prod/backup/cronjob-full.yaml) | 1 | [11-k8s-deep-dive/15-msa-k8s-grep.md](11-k8s-deep-dive/15-msa-k8s-grep.md) |
| [`k8s/infra/prod/monitoring/dashboards/kustomization.yaml`](../../k8s/infra/prod/monitoring/dashboards/kustomization.yaml) | 1 | [10-observability/05-grafana-dashboards.md](10-observability/05-grafana-dashboards.md) |
| `k8s/infra/prod/monitoring/grafana/datasources/loki.yaml` <sub>(미존재/축약)</sub> | 1 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md) |
| `k8s/infra/prod/monitoring/loki/values.yaml` <sub>(미존재/축약)</sub> | 1 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md) |
| `k8s/infra/prod/monitoring/promtail/values.yaml` <sub>(미존재/축약)</sub> | 1 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md) |
| `k8s/infra/prod/monitoring/rules/tier1-latency.yaml` <sub>(미존재/축약)</sub> | 1 | [10-observability/13-improvements.md](10-observability/13-improvements.md) |
| `k8s/infra/prod/monitoring/slos/product-availability.yaml` <sub>(미존재/축약)</sub> | 1 | [10-observability/13-improvements.md](10-observability/13-improvements.md) |
| `k8s/kustomization.yaml` <sub>(미존재/축약)</sub> | 1 | [11-k8s-deep-dive/11-helm-vs-kustomize.md](11-k8s-deep-dive/11-helm-vs-kustomize.md) |
| [`k8s/overlays/k3s-lite/kustomization.yaml`](../../k8s/overlays/k3s-lite/kustomization.yaml) | 1 | [15-connection-pool/15-codebase-audit.md](15-connection-pool/15-codebase-audit.md) |
| [`k8s/overlays/k3s-lite/patches/redis-standalone-gateway.yaml`](../../k8s/overlays/k3s-lite/patches/redis-standalone-gateway.yaml) | 1 | [11-k8s-deep-dive/02-core-resources.md](11-k8s-deep-dive/02-core-resources.md) |
| [`k8s/overlays/k3s-lite/patches/resources-reduce.yaml`](../../k8s/overlays/k3s-lite/patches/resources-reduce.yaml) | 1 | [2-jvm-gc/19-k8s-memory-vs-heap.md](2-jvm-gc/19-k8s-memory-vs-heap.md) |
| [`k8s/overlays/k3s-lite/patches/quant-phase2.yaml`](../../k8s/overlays/k3s-lite/patches/quant-phase2.yaml) | 1 | [11-k8s-deep-dive/10-deployment-strategies.md](11-k8s-deep-dive/10-deployment-strategies.md) |
| `k8s/overlays/lab/patches/profile.yaml` <sub>(미존재/축약)</sub> | 1 | [2-jvm-gc/15-lab-heap-dump-mat.md](2-jvm-gc/15-lab-heap-dump-mat.md) |
| `k8s/overlays/prod-eks/patches/ingress-alb.yaml` <sub>(미존재/축약)</sub> | 1 | [1-aws-network/17-msa-mapping.md](1-aws-network/17-msa-mapping.md) |
| `k8s/overlays/prod-k8s/gateway/rollout.yaml` <sub>(미존재/축약)</sub> | 1 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md) |
| `k8s/overlays/prod-k8s/keda/scaledobject-analytics.yaml` <sub>(미존재/축약)</sub> | 1 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md) |
| `k8s/overlays/prod-k8s/keda/scaledobject-search-consumer.yaml` <sub>(미존재/축약)</sub> | 1 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md) |
| `k8s/overlays/prod-k8s/order/rollout.yaml` <sub>(미존재/축약)</sub> | 1 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md) |
| [`k8s/overlays/prod-k8s/patches/ingress-tls.yaml`](../../k8s/overlays/prod-k8s/patches/ingress-tls.yaml) | 1 | [1-aws-network/17-msa-mapping.md](1-aws-network/17-msa-mapping.md) |
| [`k8s/overlays/prod-k8s/patches/replicas.yaml`](../../k8s/overlays/prod-k8s/patches/replicas.yaml) | 1 | [11-k8s-deep-dive/02-core-resources.md](11-k8s-deep-dive/02-core-resources.md) |
| [`k8s/overlays/prod-k8s/patches/resources.yaml`](../../k8s/overlays/prod-k8s/patches/resources.yaml) | 1 | [2-jvm-gc/19-k8s-memory-vs-heap.md](2-jvm-gc/19-k8s-memory-vs-heap.md) |
| [`k8s/overlays/prod-k8s/pdb.yaml`](../../k8s/overlays/prod-k8s/pdb.yaml) | 1 | [11-k8s-deep-dive/08-scheduling.md](11-k8s-deep-dive/08-scheduling.md) |

### Docker files (docker/)

_총 1 개 경로, 1 건 인용_

| Path | 인용 수 | 인용 학습 노트 |
|---|---:|---|
| [`docker/Dockerfile`](../../docker/Dockerfile) | 1 | [2-jvm-gc/00-plan.md](2-jvm-gc/00-plan.md) |

### buildSrc

_총 2 개 경로, 2 건 인용_

| Path | 인용 수 | 인용 학습 노트 |
|---|---:|---|
| `buildSrc/.../jib-convention.gradle.kts` <sub>(미존재/축약)</sub> | 1 | [11-k8s-deep-dive/14-k8s-security.md](11-k8s-deep-dive/14-k8s-security.md) |
| [`buildSrc/src/main/kotlin/commerce.jib-convention.gradle.kts`](../../buildSrc/src/main/kotlin/commerce.jib-convention.gradle.kts) | 1 | [2-jvm-gc/18-msa-jib-config.md](2-jvm-gc/18-msa-jib-config.md) |

### scripts

_총 1 개 경로, 1 건 인용_

| Path | 인용 수 | 인용 학습 노트 |
|---|---:|---|
| [`scripts/image-import.sh`](../../scripts/image-import.sh) | 1 | [2-jvm-gc/14-lab-gc-log.md](2-jvm-gc/14-lab-gc-log.md) |

### Root Gradle (settings/build/gradle/)

_총 3 개 경로, 23 건 인용_

| Path | 인용 수 | 인용 학습 노트 |
|---|---:|---|
| [`build.gradle.kts`](../../build.gradle.kts) | 20 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md), [10-observability/02-prometheus-pull-model.md](10-observability/02-prometheus-pull-model.md), [10-observability/08-opentelemetry-tracing.md](10-observability/08-opentelemetry-tracing.md), [10-observability/13-improvements.md](10-observability/13-improvements.md), [11-k8s-deep-dive/16-improvements.md](11-k8s-deep-dive/16-improvements.md), [12-latency-numbers/08-observability-setup.md](12-latency-numbers/08-observability-setup.md), [16-async-nonblocking-io/18-improvements.md](16-async-nonblocking-io/18-improvements.md), [17-spring-web/08-spring-aop.md](17-spring-web/08-spring-aop.md), [17-spring-web/13-jackson-naming-perf.md](17-spring-web/13-jackson-naming-perf.md), [18-grpc/05-codegen-stubs.md](18-grpc/05-codegen-stubs.md), [18-grpc/17-proto-monorepo-strategy.md](18-grpc/17-proto-monorepo-strategy.md), [18-grpc/18-virtual-migration-product.md](18-grpc/18-virtual-migration-product.md), [18-grpc/19-improvements.md](18-grpc/19-improvements.md), [2-jvm-gc/00-plan.md](2-jvm-gc/00-plan.md), [2-jvm-gc/07-zgc-deep.md](2-jvm-gc/07-zgc-deep.md), [2-jvm-gc/17-lab-jmh.md](2-jvm-gc/17-lab-jmh.md), [2-jvm-gc/18-msa-jib-config.md](2-jvm-gc/18-msa-jib-config.md), [2-jvm-gc/20-observability-prometheus.md](2-jvm-gc/20-observability-prometheus.md), [2-jvm-gc/21-improvements.md](2-jvm-gc/21-improvements.md), [5-spring-transactional/01-aop-proxy-basics.md](5-spring-transactional/01-aop-proxy-basics.md) |
| [`settings.gradle.kts`](../../settings.gradle.kts) | 2 | [18-grpc/17-proto-monorepo-strategy.md](18-grpc/17-proto-monorepo-strategy.md), [18-grpc/18-virtual-migration-product.md](18-grpc/18-virtual-migration-product.md) |
| [`gradle/libs.versions.toml`](../../gradle/libs.versions.toml) | 1 | [16-async-nonblocking-io/18-improvements.md](16-async-nonblocking-io/18-improvements.md) |

---

## §3 ADR 역인덱스

`docs/adr/` 의 각 ADR 별 인용 학습 노트.  
ADR supersede / 갱신 시 관련 학습 노트 동기화 대상 식별.

| ADR | 인용 수 | 학습 노트 |
|---|---:|---|
| [`docs/adr/ADR-0020-transactional-usage.md`](../../docs/adr/ADR-0020-transactional-usage.md) | 10 | [00-INDEX.md](00-INDEX.md), [15-connection-pool/08-pool-failure-patterns.md](15-connection-pool/08-pool-failure-patterns.md), [15-connection-pool/09-reader-writer-routing.md](15-connection-pool/09-reader-writer-routing.md), [15-connection-pool/10-replica-lag-consistency.md](15-connection-pool/10-replica-lag-consistency.md), [15-connection-pool/15-codebase-audit.md](15-connection-pool/15-codebase-audit.md), [15-connection-pool/16-pool-exhaustion-drill.md](15-connection-pool/16-pool-exhaustion-drill.md), [15-connection-pool/17-improvements.md](15-connection-pool/17-improvements.md), [15-connection-pool/18-interview-qa.md](15-connection-pool/18-interview-qa.md), [4-db-index-transaction/00-plan.md](4-db-index-transaction/00-plan.md), [5-spring-transactional/00-plan.md](5-spring-transactional/00-plan.md) |
| [`docs/adr/ADR-0012-idempotent-consumer.md`](../../docs/adr/ADR-0012-idempotent-consumer.md) | 6 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md), [00-INDEX.md](00-INDEX.md), [12-latency-numbers/05-tail-and-fanout.md](12-latency-numbers/05-tail-and-fanout.md), [15-connection-pool/18-interview-qa.md](15-connection-pool/18-interview-qa.md), [6-kafka-internals/00-plan.md](6-kafka-internals/00-plan.md), [7-distributed-systems/00-plan.md](7-distributed-systems/00-plan.md) |
| [`docs/adr/ADR-0015-resilience-strategy.md`](../../docs/adr/ADR-0015-resilience-strategy.md) | 6 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md), [00-INDEX.md](00-INDEX.md), [12-latency-numbers/05-tail-and-fanout.md](12-latency-numbers/05-tail-and-fanout.md), [15-connection-pool/12-redis-pool-tuning.md](15-connection-pool/12-redis-pool-tuning.md), [6-kafka-internals/00-plan.md](6-kafka-internals/00-plan.md), [7-distributed-systems/00-plan.md](7-distributed-systems/00-plan.md) |
| [`docs/adr/ADR-0025-latency-budget.md`](../../docs/adr/ADR-0025-latency-budget.md) | 5 | [10-observability/12-msa-current-state.md](10-observability/12-msa-current-state.md), [12-latency-numbers/00-plan.md](12-latency-numbers/00-plan.md), [12-latency-numbers/00-preview.md](12-latency-numbers/00-preview.md), [12-latency-numbers/12-adr-draft.md](12-latency-numbers/12-adr-draft.md), [15-connection-pool/01-pool-fundamentals.md](15-connection-pool/01-pool-fundamentals.md) |
| [`docs/adr/ADR-0019-k8s-migration.md`](../../docs/adr/ADR-0019-k8s-migration.md) | 4 | [00-INDEX.md](00-INDEX.md), [1-aws-network/01-vpc.md](1-aws-network/01-vpc.md), [11-k8s-deep-dive/00-plan.md](11-k8s-deep-dive/00-plan.md), [14-crdt-mrdt/17-msa-application.md](14-crdt-mrdt/17-msa-application.md) |
| [`docs/adr/ADR-0011-inventory-fulfillment-service.md`](../../docs/adr/ADR-0011-inventory-fulfillment-service.md) | 2 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md), [7-distributed-systems/00-plan.md](7-distributed-systems/00-plan.md) |
| [`docs/adr/ADR-0002-language-and-framework.md`](../../docs/adr/ADR-0002-language-and-framework.md) | 1 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md) |
| [`docs/adr/ADR-0003-inter-service-communication.md`](../../docs/adr/ADR-0003-inter-service-communication.md) | 1 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md) |
| [`docs/adr/ADR-0006-database-strategy.md`](../../docs/adr/ADR-0006-database-strategy.md) | 1 | [4-db-index-transaction/00-plan.md](4-db-index-transaction/00-plan.md) |
| [`docs/adr/ADR-0013-product-inventory-ssot.md`](../../docs/adr/ADR-0013-product-inventory-ssot.md) | 1 | [7-distributed-systems/00-plan.md](7-distributed-systems/00-plan.md) |
| [`docs/adr/ADR-0022-entity-mutation-conventions.md`](../../docs/adr/ADR-0022-entity-mutation-conventions.md) | 1 | [5-spring-transactional/00-plan.md](5-spring-transactional/00-plan.md) |
| [`docs/adr/ADR-0026-docs-taxonomy.md`](../../docs/adr/ADR-0026-docs-taxonomy.md) | 1 | [15-connection-pool/17-improvements.md](15-connection-pool/17-improvements.md) |
| `docs/adr/ADR-0028-jvm-tuning-convention.md` <sub>(미존재/축약)</sub> | 1 | [2-jvm-gc/18-msa-jib-config.md](2-jvm-gc/18-msa-jib-config.md) |

---

## §4 Convention / Architecture / Standards / Spec / Plan 역인덱스

ADR 외 docs/ 산하 표준/관례/스펙/플랜 문서의 학습 노트 인용 매핑.

### Conventions (docs/conventions/)

| Doc | 인용 수 | 학습 노트 |
|---|---:|---|
| [`docs/conventions/logging.md`](../../docs/conventions/logging.md) | 6 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md), [10-observability/06-logs-elk-vs-loki.md](10-observability/06-logs-elk-vs-loki.md), [10-observability/07-structured-logging-correlation.md](10-observability/07-structured-logging-correlation.md), [10-observability/12-msa-current-state.md](10-observability/12-msa-current-state.md), [10-observability/13-improvements.md](10-observability/13-improvements.md), [10-observability/14-interview-qa.md](10-observability/14-interview-qa.md) |
| [`docs/conventions/transactional-usage.md`](../../docs/conventions/transactional-usage.md) | 4 | [5-spring-transactional/01-aop-proxy-basics.md](5-spring-transactional/01-aop-proxy-basics.md), [5-spring-transactional/06-readonly-vs-writable.md](5-spring-transactional/06-readonly-vs-writable.md), [5-spring-transactional/08-class-level-pitfalls.md](5-spring-transactional/08-class-level-pitfalls.md), [5-spring-transactional/11-msa-mapping.md](5-spring-transactional/11-msa-mapping.md) |
| `docs/conventions/api-idempotency.md` <sub>(미존재/축약)</sub> | 1 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md) |
| [`docs/conventions/code-convention.md`](../../docs/conventions/code-convention.md) | 1 | [5-spring-transactional/03-self-invocation.md](5-spring-transactional/03-self-invocation.md) |
| `docs/conventions/distributed-lock.md` <sub>(미존재/축약)</sub> | 1 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md) |
| [`docs/conventions/entity-mutation.md`](../../docs/conventions/entity-mutation.md) | 1 | [5-spring-transactional/11-msa-mapping.md](5-spring-transactional/11-msa-mapping.md) |
| `docs/conventions/gitops.md` <sub>(미존재/축약)</sub> | 1 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md) |
| `docs/conventions/hpa-sizing.md` <sub>(미존재/축약)</sub> | 1 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md) |
| `docs/conventions/network-policy.md` <sub>(미존재/축약)</sub> | 1 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md) |
| `docs/conventions/redis-keys.md` <sub>(미존재/축약)</sub> | 1 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md) |
| `docs/conventions/response-compression.md` <sub>(미존재/축약)</sub> | 1 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md) |
| `docs/conventions/secret-management.md` <sub>(미존재/축약)</sub> | 1 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md) |

### Architecture (docs/architecture/)

| Doc | 인용 수 | 학습 노트 |
|---|---:|---|
| [`docs/architecture/kafka-convention.md`](../../docs/architecture/kafka-convention.md) | 4 | [00-LEARNING-GUIDE.md](00-LEARNING-GUIDE.md), [1-aws-network/14-cross-az-cost.md](1-aws-network/14-cross-az-cost.md), [6-kafka-internals/00-plan.md](6-kafka-internals/00-plan.md), [6-kafka-internals/11-msa-codebase-grep.md](6-kafka-internals/11-msa-codebase-grep.md) |
| [`docs/architecture/resilience-strategy.md`](../../docs/architecture/resilience-strategy.md) | 1 | [7-distributed-systems/00-plan.md](7-distributed-systems/00-plan.md) |

### Specs (docs/specs/)

| Doc | 인용 수 | 학습 노트 |
|---|---:|---|
| [`docs/specs/2026-04-09-monitoring-infrastructure-design.md`](../../docs/specs/2026-04-09-monitoring-infrastructure-design.md) | 3 | [10-observability/00-plan.md](10-observability/00-plan.md), [10-observability/05-grafana-dashboards.md](10-observability/05-grafana-dashboards.md), [10-observability/12-msa-current-state.md](10-observability/12-msa-current-state.md) |

---

## §5 Path Type 통계

| Kind | 고유 경로 수 |
|---|---:|
| `code-jvm` | 90 |
| `k8s` | 45 |
| `config` | 16 |
| `adr` | 13 |
| `conv` | 12 |
| `gradle` | 5 |
| `gradle-root` | 3 |
| `arch` | 2 |
| `buildSrc` | 2 |
| `svc-claude` | 2 |
| `sql` | 2 |
| `scripts` | 1 |
| `docker` | 1 |
| `spec` | 1 |

**Kind 의미**:
- `code-jvm`: Kotlin/Java 소스
- `code-py`: Python 소스 (charting 등)
- `code-fe`: TypeScript/JavaScript (FE)
- `config`: application.yml / yaml 설정
- `gradle` / `gradle-root`: Gradle 빌드 스크립트
- `sql`: Flyway 마이그레이션 등
- `k8s`: k8s manifest
- `docker`: Dockerfile / docker-compose
- `buildSrc` / `scripts`: 빌드/배포 보조 스크립트
- `adr` / `conv` / `arch` / `std` / `spec` / `plan`: msa 루트 docs 분류
- `svc-doc` / `svc-claude`: 서비스 디렉토리 내부 docs / CLAUDE.md

### 서비스별 인용량 합계

| 서비스 | 고유 경로 수 | 총 인용 수 |
|---|---:|---:|
| `common` | 33 | 49 |
| `gateway` | 23 | 49 |
| `quant` | 17 | 27 |
| `order` | 13 | 20 |
| `product` | 8 | 17 |
| `inventory` | 10 | 11 |
| `analytics` | 2 | 5 |
| `auth` | 1 | 4 |
| `fulfillment` | 2 | 3 |
| `agent-viewer` | 2 | 2 |
| `gifticon` | 1 | 2 |
| `chatbot` | 1 | 1 |
| `ai` | 1 | 1 |
| `search` | 1 | 1 |

---

## §6 Forward Index — 학습 노트별 인용 코드

학습 노트가 어느 코드/문서를 인용하는지의 정방향 매핑.  
학습 노트를 갱신할 때 "이 노트가 의존하는 코드가 여전히 유효한가" 검증에 사용.

### 토픽별 통계

| 토픽 | 인용 학습 노트 수 | 총 인용 path 수 |
|---|---:|---:|
| #1 AWS Network | 6 | 11 |
| #10 Observability | 10 | 29 |
| #11 K8s Deep Dive | 11 | 24 |
| #12 Latency Numbers | 5 | 6 |
| #13 Crypto/JWT/SSO | 2 | 8 |
| #14 CRDT/MRDT | 1 | 1 |
| #15 Connection Pool | 14 | 35 |
| #16 Async/Non-blocking IO | 7 | 19 |
| #17 Spring Web | 10 | 27 |
| #18 gRPC | 4 | 10 |
| #2 JVM/GC | 9 | 24 |
| #3 Java/Kotlin Concurrency | 12 | 39 |
| #4 DB Index/Transaction | 2 | 4 |
| #5 Spring @Transactional | 8 | 11 |
| #6 Kafka Internals | 6 | 16 |
| #7 Distributed Systems | 9 | 15 |
| #8 System Design | 2 | 3 |
| #9 Redis Deep Dive | 8 | 17 |
| 루트 (00-INDEX 등) | 3 | 74 |

### #1 AWS Network

_총 6 개 학습 노트, 11 건 인용_

| 학습 노트 | 인용 path 수 | 인용된 msa path |
|---|---:|---|
| [1-aws-network/17-msa-mapping.md](1-aws-network/17-msa-mapping.md) | 4 | `gateway/ingress.yaml` <sub>(미존재/축약)</sub>, [`k8s/base/gateway/ingress.yaml`](../../k8s/base/gateway/ingress.yaml), `k8s/overlays/prod-eks/patches/ingress-alb.yaml` <sub>(미존재/축약)</sub>, [`k8s/overlays/prod-k8s/patches/ingress-tls.yaml`](../../k8s/overlays/prod-k8s/patches/ingress-tls.yaml) |
| [1-aws-network/09-alb.md](1-aws-network/09-alb.md) | 2 | `gateway/ingress.yaml` <sub>(미존재/축약)</sub>, [`k8s/base/gateway/ingress.yaml`](../../k8s/base/gateway/ingress.yaml) |
| [1-aws-network/13-eks-networking.md](1-aws-network/13-eks-networking.md) | 2 | `gateway/ingress.yaml` <sub>(미존재/축약)</sub>, [`k8s/base/gateway/ingress.yaml`](../../k8s/base/gateway/ingress.yaml) |
| [1-aws-network/00-plan.md](1-aws-network/00-plan.md) | 1 | [`k8s/base/frontend-ingress.yaml`](../../k8s/base/frontend-ingress.yaml) |
| [1-aws-network/01-vpc.md](1-aws-network/01-vpc.md) | 1 | [`docs/adr/ADR-0019-k8s-migration.md`](../../docs/adr/ADR-0019-k8s-migration.md) |
| [1-aws-network/14-cross-az-cost.md](1-aws-network/14-cross-az-cost.md) | 1 | [`docs/architecture/kafka-convention.md`](../../docs/architecture/kafka-convention.md) |

### #10 Observability

_총 10 개 학습 노트, 29 건 인용_

| 학습 노트 | 인용 path 수 | 인용된 msa path |
|---|---:|---|
| [10-observability/12-msa-current-state.md](10-observability/12-msa-current-state.md) | 7 | [`docs/adr/ADR-0025-latency-budget.md`](../../docs/adr/ADR-0025-latency-budget.md), [`docs/conventions/logging.md`](../../docs/conventions/logging.md), [`docs/specs/2026-04-09-monitoring-infrastructure-design.md`](../../docs/specs/2026-04-09-monitoring-infrastructure-design.md), [`k8s/infra/prod/monitoring/servicemonitor-apps.yaml`](../../k8s/infra/prod/monitoring/servicemonitor-apps.yaml), [`k8s/infra/prod/monitoring/values.yaml`](../../k8s/infra/prod/monitoring/values.yaml), [`product/app/src/main/resources/application.yml`](../../product/app/src/main/resources/application.yml), [`quant/app/src/main/kotlin/com/kgd/quant/infrastructure/metrics/QuantMetrics.kt`](../../quant/app/src/main/kotlin/com/kgd/quant/infrastructure/metrics/QuantMetrics.kt) |
| [10-observability/13-improvements.md](10-observability/13-improvements.md) | 7 | [`build.gradle.kts`](../../build.gradle.kts), `common/application.yml` <sub>(미존재/축약)</sub>, [`common/build.gradle.kts`](../../common/build.gradle.kts), `common/src/main/resources/application.yml` <sub>(미존재/축약)</sub>, [`docs/conventions/logging.md`](../../docs/conventions/logging.md), `k8s/infra/prod/monitoring/rules/tier1-latency.yaml` <sub>(미존재/축약)</sub>, `k8s/infra/prod/monitoring/slos/product-availability.yaml` <sub>(미존재/축약)</sub> |
| [10-observability/02-prometheus-pull-model.md](10-observability/02-prometheus-pull-model.md) | 4 | [`build.gradle.kts`](../../build.gradle.kts), [`k8s/infra/prod/monitoring/servicemonitor-apps.yaml`](../../k8s/infra/prod/monitoring/servicemonitor-apps.yaml), [`product/app/build.gradle.kts`](../../product/app/build.gradle.kts), [`product/app/src/main/resources/application.yml`](../../product/app/src/main/resources/application.yml) |
| [10-observability/01-observability-foundations.md](10-observability/01-observability-foundations.md) | 2 | [`k8s/infra/prod/monitoring/servicemonitor-apps.yaml`](../../k8s/infra/prod/monitoring/servicemonitor-apps.yaml), [`k8s/infra/prod/monitoring/values.yaml`](../../k8s/infra/prod/monitoring/values.yaml) |
| [10-observability/05-grafana-dashboards.md](10-observability/05-grafana-dashboards.md) | 2 | [`docs/specs/2026-04-09-monitoring-infrastructure-design.md`](../../docs/specs/2026-04-09-monitoring-infrastructure-design.md), [`k8s/infra/prod/monitoring/dashboards/kustomization.yaml`](../../k8s/infra/prod/monitoring/dashboards/kustomization.yaml) |
| [10-observability/08-opentelemetry-tracing.md](10-observability/08-opentelemetry-tracing.md) | 2 | [`build.gradle.kts`](../../build.gradle.kts), [`product/app/build.gradle.kts`](../../product/app/build.gradle.kts) |
| [10-observability/14-interview-qa.md](10-observability/14-interview-qa.md) | 2 | [`docs/conventions/logging.md`](../../docs/conventions/logging.md), [`k8s/infra/prod/monitoring/servicemonitor-apps.yaml`](../../k8s/infra/prod/monitoring/servicemonitor-apps.yaml) |
| [10-observability/00-plan.md](10-observability/00-plan.md) | 1 | [`docs/specs/2026-04-09-monitoring-infrastructure-design.md`](../../docs/specs/2026-04-09-monitoring-infrastructure-design.md) |
| [10-observability/06-logs-elk-vs-loki.md](10-observability/06-logs-elk-vs-loki.md) | 1 | [`docs/conventions/logging.md`](../../docs/conventions/logging.md) |
| [10-observability/07-structured-logging-correlation.md](10-observability/07-structured-logging-correlation.md) | 1 | [`docs/conventions/logging.md`](../../docs/conventions/logging.md) |

### #11 K8s Deep Dive

_총 11 개 학습 노트, 24 건 인용_

| 학습 노트 | 인용 path 수 | 인용된 msa path |
|---|---:|---|
| [11-k8s-deep-dive/02-core-resources.md](11-k8s-deep-dive/02-core-resources.md) | 5 | `gateway/deployment.yaml` <sub>(미존재/축약)</sub>, [`k8s/base/gateway/deployment.yaml`](../../k8s/base/gateway/deployment.yaml), [`k8s/infra/prod/monitoring/servicemonitor-apps.yaml`](../../k8s/infra/prod/monitoring/servicemonitor-apps.yaml), [`k8s/overlays/k3s-lite/patches/redis-standalone-gateway.yaml`](../../k8s/overlays/k3s-lite/patches/redis-standalone-gateway.yaml), [`k8s/overlays/prod-k8s/patches/replicas.yaml`](../../k8s/overlays/prod-k8s/patches/replicas.yaml) |
| [11-k8s-deep-dive/15-msa-k8s-grep.md](11-k8s-deep-dive/15-msa-k8s-grep.md) | 5 | `gateway/deployment.yaml` <sub>(미존재/축약)</sub>, [`k8s/base/gateway/deployment.yaml`](../../k8s/base/gateway/deployment.yaml), [`k8s/infra/prod/backup/cronjob-full.yaml`](../../k8s/infra/prod/backup/cronjob-full.yaml), [`k8s/infra/prod/monitoring/servicemonitor-apps.yaml`](../../k8s/infra/prod/monitoring/servicemonitor-apps.yaml), [`k8s/infra/prod/strimzi/kafka-cluster.yaml`](../../k8s/infra/prod/strimzi/kafka-cluster.yaml) |
| [11-k8s-deep-dive/16-improvements.md](11-k8s-deep-dive/16-improvements.md) | 4 | [`build.gradle.kts`](../../build.gradle.kts), `k8s/base/namespace-pss.yaml` <sub>(미존재/축약)</sub>, `k8s/base/network-policy/default-deny.yaml` <sub>(미존재/축약)</sub>, `k8s/overlays/prod-k8s/patches/topology-spread.yaml` <sub>(미존재/축약)</sub> |
| [11-k8s-deep-dive/06-ingress-gateway-api.md](11-k8s-deep-dive/06-ingress-gateway-api.md) | 2 | `gateway/ingress.yaml` <sub>(미존재/축약)</sub>, [`k8s/base/gateway/ingress.yaml`](../../k8s/base/gateway/ingress.yaml) |
| [11-k8s-deep-dive/09-autoscaling.md](11-k8s-deep-dive/09-autoscaling.md) | 2 | `k8s/hpa.yaml` <sub>(미존재/축약)</sub>, [`k8s/infra/prod/monitoring/servicemonitor-apps.yaml`](../../k8s/infra/prod/monitoring/servicemonitor-apps.yaml) |
| [11-k8s-deep-dive/00-plan.md](11-k8s-deep-dive/00-plan.md) | 1 | [`docs/adr/ADR-0019-k8s-migration.md`](../../docs/adr/ADR-0019-k8s-migration.md) |
| [11-k8s-deep-dive/07-storage.md](11-k8s-deep-dive/07-storage.md) | 1 | [`k8s/infra/local/redis/statefulset.yaml`](../../k8s/infra/local/redis/statefulset.yaml) |
| [11-k8s-deep-dive/08-scheduling.md](11-k8s-deep-dive/08-scheduling.md) | 1 | [`k8s/overlays/prod-k8s/pdb.yaml`](../../k8s/overlays/prod-k8s/pdb.yaml) |
| [11-k8s-deep-dive/10-deployment-strategies.md](11-k8s-deep-dive/10-deployment-strategies.md) | 1 | [`k8s/overlays/k3s-lite/patches/quant-phase2.yaml`](../../k8s/overlays/k3s-lite/patches/quant-phase2.yaml) |
| [11-k8s-deep-dive/11-helm-vs-kustomize.md](11-k8s-deep-dive/11-helm-vs-kustomize.md) | 1 | `k8s/kustomization.yaml` <sub>(미존재/축약)</sub> |
| [11-k8s-deep-dive/14-k8s-security.md](11-k8s-deep-dive/14-k8s-security.md) | 1 | `buildSrc/.../jib-convention.gradle.kts` <sub>(미존재/축약)</sub> |

### #12 Latency Numbers

_총 5 개 학습 노트, 6 건 인용_

| 학습 노트 | 인용 path 수 | 인용된 msa path |
|---|---:|---|
| [12-latency-numbers/05-tail-and-fanout.md](12-latency-numbers/05-tail-and-fanout.md) | 2 | [`docs/adr/ADR-0012-idempotent-consumer.md`](../../docs/adr/ADR-0012-idempotent-consumer.md), [`docs/adr/ADR-0015-resilience-strategy.md`](../../docs/adr/ADR-0015-resilience-strategy.md) |
| [12-latency-numbers/00-plan.md](12-latency-numbers/00-plan.md) | 1 | [`docs/adr/ADR-0025-latency-budget.md`](../../docs/adr/ADR-0025-latency-budget.md) |
| [12-latency-numbers/00-preview.md](12-latency-numbers/00-preview.md) | 1 | [`docs/adr/ADR-0025-latency-budget.md`](../../docs/adr/ADR-0025-latency-budget.md) |
| [12-latency-numbers/08-observability-setup.md](12-latency-numbers/08-observability-setup.md) | 1 | [`build.gradle.kts`](../../build.gradle.kts) |
| [12-latency-numbers/12-adr-draft.md](12-latency-numbers/12-adr-draft.md) | 1 | [`docs/adr/ADR-0025-latency-budget.md`](../../docs/adr/ADR-0025-latency-budget.md) |

### #13 Crypto/JWT/SSO

_총 2 개 학습 노트, 8 건 인용_

| 학습 노트 | 인용 path 수 | 인용된 msa path |
|---|---:|---|
| [13-crypto-jwt-sso/00-plan.md](13-crypto-jwt-sso/00-plan.md) | 7 | [`common/src/main/kotlin/com/kgd/common/security/AesUtil.kt`](../../common/src/main/kotlin/com/kgd/common/security/AesUtil.kt), [`common/src/main/kotlin/com/kgd/common/security/CommonSecurityAutoConfiguration.kt`](../../common/src/main/kotlin/com/kgd/common/security/CommonSecurityAutoConfiguration.kt), [`common/src/main/kotlin/com/kgd/common/security/JwtProperties.kt`](../../common/src/main/kotlin/com/kgd/common/security/JwtProperties.kt), [`common/src/main/kotlin/com/kgd/common/security/JwtUtil.kt`](../../common/src/main/kotlin/com/kgd/common/security/JwtUtil.kt), [`common/src/test/kotlin/com/kgd/common/security/AesUtilTest.kt`](../../common/src/test/kotlin/com/kgd/common/security/AesUtilTest.kt), [`gateway/src/main/kotlin/com/kgd/gateway/filter/AuthenticationGatewayFilter.kt`](../../gateway/src/main/kotlin/com/kgd/gateway/filter/AuthenticationGatewayFilter.kt), [`gateway/src/main/kotlin/com/kgd/gateway/security/JwtTokenValidator.kt`](../../gateway/src/main/kotlin/com/kgd/gateway/security/JwtTokenValidator.kt) |
| [13-crypto-jwt-sso/02-aes-modes.md](13-crypto-jwt-sso/02-aes-modes.md) | 1 | [`common/src/main/kotlin/com/kgd/common/security/AesUtil.kt`](../../common/src/main/kotlin/com/kgd/common/security/AesUtil.kt) |

### #14 CRDT/MRDT

_총 1 개 학습 노트, 1 건 인용_

| 학습 노트 | 인용 path 수 | 인용된 msa path |
|---|---:|---|
| [14-crdt-mrdt/17-msa-application.md](14-crdt-mrdt/17-msa-application.md) | 1 | [`docs/adr/ADR-0019-k8s-migration.md`](../../docs/adr/ADR-0019-k8s-migration.md) |

### #15 Connection Pool

_총 14 개 학습 노트, 35 건 인용_

| 학습 노트 | 인용 path 수 | 인용된 msa path |
|---|---:|---|
| [15-connection-pool/15-codebase-audit.md](15-connection-pool/15-codebase-audit.md) | 6 | [`common/src/main/kotlin/com/kgd/common/redis/CommonRedisAutoConfiguration.kt`](../../common/src/main/kotlin/com/kgd/common/redis/CommonRedisAutoConfiguration.kt), [`docs/adr/ADR-0020-transactional-usage.md`](../../docs/adr/ADR-0020-transactional-usage.md), `gateway/application.yml` <sub>(미존재/축약)</sub>, [`gateway/src/main/resources/application.yml`](../../gateway/src/main/resources/application.yml), [`k8s/overlays/k3s-lite/kustomization.yaml`](../../k8s/overlays/k3s-lite/kustomization.yaml), [`product/app/src/main/kotlin/com/kgd/product/config/DataSourceConfig.kt`](../../product/app/src/main/kotlin/com/kgd/product/config/DataSourceConfig.kt) |
| [15-connection-pool/17-improvements.md](15-connection-pool/17-improvements.md) | 6 | `common/src/main/kotlin/com/kgd/common/datasource/CommonDataSourceAutoConfiguration.kt` <sub>(미존재/축약)</sub>, `common/src/main/kotlin/com/kgd/common/datasource/Stickiness.kt` <sub>(미존재/축약)</sub>, [`common/src/main/kotlin/com/kgd/common/redis/CommonRedisAutoConfiguration.kt`](../../common/src/main/kotlin/com/kgd/common/redis/CommonRedisAutoConfiguration.kt), [`docs/adr/ADR-0020-transactional-usage.md`](../../docs/adr/ADR-0020-transactional-usage.md), [`docs/adr/ADR-0026-docs-taxonomy.md`](../../docs/adr/ADR-0026-docs-taxonomy.md), [`product/app/src/main/kotlin/com/kgd/product/config/DataSourceConfig.kt`](../../product/app/src/main/kotlin/com/kgd/product/config/DataSourceConfig.kt) |
| [15-connection-pool/18-interview-qa.md](15-connection-pool/18-interview-qa.md) | 6 | [`common/src/main/kotlin/com/kgd/common/redis/CommonRedisAutoConfiguration.kt`](../../common/src/main/kotlin/com/kgd/common/redis/CommonRedisAutoConfiguration.kt), [`docs/adr/ADR-0012-idempotent-consumer.md`](../../docs/adr/ADR-0012-idempotent-consumer.md), [`docs/adr/ADR-0020-transactional-usage.md`](../../docs/adr/ADR-0020-transactional-usage.md), `gateway/application.yml` <sub>(미존재/축약)</sub>, [`gateway/src/main/resources/application.yml`](../../gateway/src/main/resources/application.yml), [`product/app/src/main/kotlin/com/kgd/product/config/DataSourceConfig.kt`](../../product/app/src/main/kotlin/com/kgd/product/config/DataSourceConfig.kt) |
| [15-connection-pool/09-reader-writer-routing.md](15-connection-pool/09-reader-writer-routing.md) | 3 | [`docs/adr/ADR-0020-transactional-usage.md`](../../docs/adr/ADR-0020-transactional-usage.md), `product/DataSourceConfig.kt` <sub>(미존재/축약)</sub>, [`product/app/src/main/kotlin/com/kgd/product/config/DataSourceConfig.kt`](../../product/app/src/main/kotlin/com/kgd/product/config/DataSourceConfig.kt) |
| [15-connection-pool/13-reactive-r2dbc.md](15-connection-pool/13-reactive-r2dbc.md) | 3 | `gateway/application.yml` <sub>(미존재/축약)</sub>, [`gateway/src/main/resources/application.yml`](../../gateway/src/main/resources/application.yml), [`quant/CLAUDE.md`](../../quant/CLAUDE.md) |
| [15-connection-pool/12-redis-pool-tuning.md](15-connection-pool/12-redis-pool-tuning.md) | 2 | [`common/src/main/kotlin/com/kgd/common/redis/CommonRedisAutoConfiguration.kt`](../../common/src/main/kotlin/com/kgd/common/redis/CommonRedisAutoConfiguration.kt), [`docs/adr/ADR-0015-resilience-strategy.md`](../../docs/adr/ADR-0015-resilience-strategy.md) |
| [15-connection-pool/16-pool-exhaustion-drill.md](15-connection-pool/16-pool-exhaustion-drill.md) | 2 | [`docs/adr/ADR-0020-transactional-usage.md`](../../docs/adr/ADR-0020-transactional-usage.md), [`order/app/src/main/resources/application.yml`](../../order/app/src/main/resources/application.yml) |
| [15-connection-pool/00-plan.md](15-connection-pool/00-plan.md) | 1 | `gateway/app/src/main/resources/application.yml` <sub>(미존재/축약)</sub> |
| [15-connection-pool/00-preview.md](15-connection-pool/00-preview.md) | 1 | [`product/app/src/main/kotlin/com/kgd/product/config/DataSourceConfig.kt`](../../product/app/src/main/kotlin/com/kgd/product/config/DataSourceConfig.kt) |
| [15-connection-pool/01-pool-fundamentals.md](15-connection-pool/01-pool-fundamentals.md) | 1 | [`docs/adr/ADR-0025-latency-budget.md`](../../docs/adr/ADR-0025-latency-budget.md) |
| [15-connection-pool/03-spring-boot-defaults.md](15-connection-pool/03-spring-boot-defaults.md) | 1 | [`product/app/src/main/kotlin/com/kgd/product/config/DataSourceConfig.kt`](../../product/app/src/main/kotlin/com/kgd/product/config/DataSourceConfig.kt) |
| [15-connection-pool/08-pool-failure-patterns.md](15-connection-pool/08-pool-failure-patterns.md) | 1 | [`docs/adr/ADR-0020-transactional-usage.md`](../../docs/adr/ADR-0020-transactional-usage.md) |
| [15-connection-pool/10-replica-lag-consistency.md](15-connection-pool/10-replica-lag-consistency.md) | 1 | [`docs/adr/ADR-0020-transactional-usage.md`](../../docs/adr/ADR-0020-transactional-usage.md) |
| [15-connection-pool/11-redis-lettuce-vs-jedis.md](15-connection-pool/11-redis-lettuce-vs-jedis.md) | 1 | [`common/src/main/kotlin/com/kgd/common/redis/CommonRedisAutoConfiguration.kt`](../../common/src/main/kotlin/com/kgd/common/redis/CommonRedisAutoConfiguration.kt) |

### #16 Async/Non-blocking IO

_총 7 개 학습 노트, 19 건 인용_

| 학습 노트 | 인용 path 수 | 인용된 msa path |
|---|---:|---|
| [16-async-nonblocking-io/17-http-client-tradeoffs.md](16-async-nonblocking-io/17-http-client-tradeoffs.md) | 5 | `ai/ClaudeApiAdapter.kt` <sub>(미존재/축약)</sub>, [`chatbot/app/src/main/kotlin/com/kgd/chatbot/infrastructure/ai/ClaudeApiAdapter.kt`](../../chatbot/app/src/main/kotlin/com/kgd/chatbot/infrastructure/ai/ClaudeApiAdapter.kt), [`common/src/main/kotlin/com/kgd/common/webclient/CommonWebClientAutoConfiguration.kt`](../../common/src/main/kotlin/com/kgd/common/webclient/CommonWebClientAutoConfiguration.kt), `order/WebClientConfig.kt` <sub>(미존재/축약)</sub>, [`order/app/src/main/kotlin/com/kgd/order/client/ProductAdapter.kt`](../../order/app/src/main/kotlin/com/kgd/order/client/ProductAdapter.kt) |
| [16-async-nonblocking-io/15-msa-gateway-webflux.md](16-async-nonblocking-io/15-msa-gateway-webflux.md) | 4 | [`gateway/CLAUDE.md`](../../gateway/CLAUDE.md), [`gateway/src/main/kotlin/com/kgd/gateway/config/GatewayRouteConfig.kt`](../../gateway/src/main/kotlin/com/kgd/gateway/config/GatewayRouteConfig.kt), [`gateway/src/main/kotlin/com/kgd/gateway/config/RedisConfig.kt`](../../gateway/src/main/kotlin/com/kgd/gateway/config/RedisConfig.kt), [`gateway/src/main/kotlin/com/kgd/gateway/filter/AuthenticationGatewayFilter.kt`](../../gateway/src/main/kotlin/com/kgd/gateway/filter/AuthenticationGatewayFilter.kt) |
| [16-async-nonblocking-io/18-improvements.md](16-async-nonblocking-io/18-improvements.md) | 4 | [`build.gradle.kts`](../../build.gradle.kts), [`gateway/build.gradle.kts`](../../gateway/build.gradle.kts), [`gradle/libs.versions.toml`](../../gradle/libs.versions.toml), `order/ProductAdapter.kt` <sub>(미존재/축약)</sub> |
| [16-async-nonblocking-io/16-lettuce-kafka-nio.md](16-async-nonblocking-io/16-lettuce-kafka-nio.md) | 3 | [`common/src/main/kotlin/com/kgd/common/redis/CommonRedisAutoConfiguration.kt`](../../common/src/main/kotlin/com/kgd/common/redis/CommonRedisAutoConfiguration.kt), `order/KafkaConfig.kt` <sub>(미존재/축약)</sub>, `order/messaging/OrderEventConsumer.kt` <sub>(미존재/축약)</sub> |
| [16-async-nonblocking-io/10-project-reactor.md](16-async-nonblocking-io/10-project-reactor.md) | 1 | `order/ProductAdapter.kt` <sub>(미존재/축약)</sub> |
| [16-async-nonblocking-io/12-webflux-vs-mvc.md](16-async-nonblocking-io/12-webflux-vs-mvc.md) | 1 | [`gateway/CLAUDE.md`](../../gateway/CLAUDE.md) |
| [16-async-nonblocking-io/14-coroutine-vs-reactor.md](16-async-nonblocking-io/14-coroutine-vs-reactor.md) | 1 | [`order/app/src/main/kotlin/com/kgd/order/client/ProductAdapter.kt`](../../order/app/src/main/kotlin/com/kgd/order/client/ProductAdapter.kt) |

### #17 Spring Web

_총 10 개 학습 노트, 27 건 인용_

| 학습 노트 | 인용 path 수 | 인용된 msa path |
|---|---:|---|
| [17-spring-web/17-msa-gateway-filter.md](17-spring-web/17-msa-gateway-filter.md) | 5 | [`gateway/src/main/kotlin/com/kgd/gateway/config/RateLimiterConfig.kt`](../../gateway/src/main/kotlin/com/kgd/gateway/config/RateLimiterConfig.kt), [`gateway/src/main/kotlin/com/kgd/gateway/config/SecurityConfig.kt`](../../gateway/src/main/kotlin/com/kgd/gateway/config/SecurityConfig.kt), [`gateway/src/main/kotlin/com/kgd/gateway/filter/AuthenticationGatewayFilter.kt`](../../gateway/src/main/kotlin/com/kgd/gateway/filter/AuthenticationGatewayFilter.kt), [`gateway/src/main/kotlin/com/kgd/gateway/filter/RequestLoggingFilter.kt`](../../gateway/src/main/kotlin/com/kgd/gateway/filter/RequestLoggingFilter.kt), [`gateway/src/main/kotlin/com/kgd/gateway/filter/VisitorIdFilter.kt`](../../gateway/src/main/kotlin/com/kgd/gateway/filter/VisitorIdFilter.kt) |
| [17-spring-web/19-improvements.md](17-spring-web/19-improvements.md) | 5 | `common/src/main/kotlin/com/kgd/common/web/TraceIdFilter.kt` <sub>(미존재/축약)</sub>, `gateway/ingress-private.yaml` <sub>(미존재/축약)</sub>, `gateway/src/main/kotlin/com/kgd/gateway/filter/TraceIdFilter.kt` <sub>(미존재/축약)</sub>, `k8s/base/gateway/ingress-private.yaml` <sub>(미존재/축약)</sub>, `k8s/infra/local/ingress-nginx/values.yaml` <sub>(미존재/축약)</sub> |
| [17-spring-web/18-msa-common-patterns.md](17-spring-web/18-msa-common-patterns.md) | 4 | [`common/src/main/kotlin/com/kgd/common/jackson/CommonJacksonAutoConfiguration.kt`](../../common/src/main/kotlin/com/kgd/common/jackson/CommonJacksonAutoConfiguration.kt), `common/src/main/kotlin/com/kgd/common/web/ApiResponseAdvice.kt` <sub>(미존재/축약)</sub>, `common/src/main/kotlin/com/kgd/common/web/TraceIdFilter.kt` <sub>(미존재/축약)</sub>, `k8s/infra/local/ingress-nginx/values.yaml` <sub>(미존재/축약)</sub> |
| [17-spring-web/02-filter-vs-interceptor-vs-aop.md](17-spring-web/02-filter-vs-interceptor-vs-aop.md) | 3 | [`gateway/src/main/kotlin/com/kgd/gateway/filter/AuthenticationGatewayFilter.kt`](../../gateway/src/main/kotlin/com/kgd/gateway/filter/AuthenticationGatewayFilter.kt), [`gateway/src/main/kotlin/com/kgd/gateway/filter/RequestLoggingFilter.kt`](../../gateway/src/main/kotlin/com/kgd/gateway/filter/RequestLoggingFilter.kt), [`gateway/src/main/kotlin/com/kgd/gateway/filter/VisitorIdFilter.kt`](../../gateway/src/main/kotlin/com/kgd/gateway/filter/VisitorIdFilter.kt) |
| [17-spring-web/14-gzip-layers.md](17-spring-web/14-gzip-layers.md) | 3 | `gateway/ingress.yaml` <sub>(미존재/축약)</sub>, [`k8s/base/gateway/ingress.yaml`](../../k8s/base/gateway/ingress.yaml), `k8s/infra/local/ingress-nginx/values.yaml` <sub>(미존재/축약)</sub> |
| [17-spring-web/01-http-pipeline.md](17-spring-web/01-http-pipeline.md) | 2 | `gateway/ingress.yaml` <sub>(미존재/축약)</sub>, [`k8s/base/gateway/ingress.yaml`](../../k8s/base/gateway/ingress.yaml) |
| [17-spring-web/09-jackson-objectmapper.md](17-spring-web/09-jackson-objectmapper.md) | 2 | [`agent-viewer/api/src/main/kotlin/com/kgd/agentviewer/config/JacksonConfig.kt`](../../agent-viewer/api/src/main/kotlin/com/kgd/agentviewer/config/JacksonConfig.kt), [`common/src/main/kotlin/com/kgd/common/jackson/CommonJacksonAutoConfiguration.kt`](../../common/src/main/kotlin/com/kgd/common/jackson/CommonJacksonAutoConfiguration.kt) |
| [17-spring-web/06-security-filter-chain.md](17-spring-web/06-security-filter-chain.md) | 1 | [`gateway/src/main/kotlin/com/kgd/gateway/config/SecurityConfig.kt`](../../gateway/src/main/kotlin/com/kgd/gateway/config/SecurityConfig.kt) |
| [17-spring-web/08-spring-aop.md](17-spring-web/08-spring-aop.md) | 1 | [`build.gradle.kts`](../../build.gradle.kts) |
| [17-spring-web/13-jackson-naming-perf.md](17-spring-web/13-jackson-naming-perf.md) | 1 | [`build.gradle.kts`](../../build.gradle.kts) |

### #18 gRPC

_총 4 개 학습 노트, 10 건 인용_

| 학습 노트 | 인용 path 수 | 인용된 msa path |
|---|---:|---|
| [18-grpc/18-virtual-migration-product.md](18-grpc/18-virtual-migration-product.md) | 5 | [`build.gradle.kts`](../../build.gradle.kts), [`order/app/build.gradle.kts`](../../order/app/build.gradle.kts), `order/app/src/main/kotlin/com/kgd/order/infrastructure/client/ProductAdapter.kt` <sub>(미존재/축약)</sub>, [`product/app/build.gradle.kts`](../../product/app/build.gradle.kts), [`settings.gradle.kts`](../../settings.gradle.kts) |
| [18-grpc/17-proto-monorepo-strategy.md](18-grpc/17-proto-monorepo-strategy.md) | 3 | [`build.gradle.kts`](../../build.gradle.kts), [`order/app/build.gradle.kts`](../../order/app/build.gradle.kts), [`settings.gradle.kts`](../../settings.gradle.kts) |
| [18-grpc/05-codegen-stubs.md](18-grpc/05-codegen-stubs.md) | 1 | [`build.gradle.kts`](../../build.gradle.kts) |
| [18-grpc/19-improvements.md](18-grpc/19-improvements.md) | 1 | [`build.gradle.kts`](../../build.gradle.kts) |

### #2 JVM/GC

_총 9 개 학습 노트, 24 건 인용_

| 학습 노트 | 인용 path 수 | 인용된 msa path |
|---|---:|---|
| [2-jvm-gc/18-msa-jib-config.md](2-jvm-gc/18-msa-jib-config.md) | 5 | [`build.gradle.kts`](../../build.gradle.kts), [`buildSrc/src/main/kotlin/commerce.jib-convention.gradle.kts`](../../buildSrc/src/main/kotlin/commerce.jib-convention.gradle.kts), `docs/adr/ADR-0028-jvm-tuning-convention.md` <sub>(미존재/축약)</sub>, [`k8s/base/quant/deployment.yaml`](../../k8s/base/quant/deployment.yaml), `quant/deployment.yaml` <sub>(미존재/축약)</sub> |
| [2-jvm-gc/19-k8s-memory-vs-heap.md](2-jvm-gc/19-k8s-memory-vs-heap.md) | 4 | [`k8s/base/product/deployment.yaml`](../../k8s/base/product/deployment.yaml), [`k8s/overlays/k3s-lite/patches/resources-reduce.yaml`](../../k8s/overlays/k3s-lite/patches/resources-reduce.yaml), [`k8s/overlays/prod-k8s/patches/resources.yaml`](../../k8s/overlays/prod-k8s/patches/resources.yaml), `product/deployment.yaml` <sub>(미존재/축약)</sub> |
| [2-jvm-gc/20-observability-prometheus.md](2-jvm-gc/20-observability-prometheus.md) | 4 | [`build.gradle.kts`](../../build.gradle.kts), [`common/build.gradle.kts`](../../common/build.gradle.kts), [`k8s/infra/prod/monitoring/servicemonitor-apps.yaml`](../../k8s/infra/prod/monitoring/servicemonitor-apps.yaml), [`product/app/build.gradle.kts`](../../product/app/build.gradle.kts) |
| [2-jvm-gc/21-improvements.md](2-jvm-gc/21-improvements.md) | 3 | [`build.gradle.kts`](../../build.gradle.kts), [`gateway/build.gradle.kts`](../../gateway/build.gradle.kts), `k8s/infra/prod/monitoring/jvm-alerts.yaml` <sub>(미존재/축약)</sub> |
| [2-jvm-gc/00-plan.md](2-jvm-gc/00-plan.md) | 2 | [`build.gradle.kts`](../../build.gradle.kts), [`docker/Dockerfile`](../../docker/Dockerfile) |
| [2-jvm-gc/07-zgc-deep.md](2-jvm-gc/07-zgc-deep.md) | 2 | [`build.gradle.kts`](../../build.gradle.kts), [`quant/app/build.gradle.kts`](../../quant/app/build.gradle.kts) |
| [2-jvm-gc/15-lab-heap-dump-mat.md](2-jvm-gc/15-lab-heap-dump-mat.md) | 2 | `k8s/overlays/lab/patches/profile.yaml` <sub>(미존재/축약)</sub>, `product/app/src/main/kotlin/com/kgd/product/lab/LabLeakController.kt` <sub>(미존재/축약)</sub> |
| [2-jvm-gc/14-lab-gc-log.md](2-jvm-gc/14-lab-gc-log.md) | 1 | [`scripts/image-import.sh`](../../scripts/image-import.sh) |
| [2-jvm-gc/17-lab-jmh.md](2-jvm-gc/17-lab-jmh.md) | 1 | [`build.gradle.kts`](../../build.gradle.kts) |

### #3 Java/Kotlin Concurrency

_총 12 개 학습 노트, 39 건 인용_

| 학습 노트 | 인용 path 수 | 인용된 msa path |
|---|---:|---|
| [3-java-kotlin-concurrency/22-msa-concurrency-patterns.md](3-java-kotlin-concurrency/22-msa-concurrency-patterns.md) | 21 | `agent-viewer/InMemoryStateStore.kt` <sub>(미존재/축약)</sub>, `analytics/EventIngestionConsumer.kt` <sub>(미존재/축약)</sub>, `auth/AuthService.kt` <sub>(미존재/축약)</sub>, `fulfillment/OutboxPollingPublisher.kt` <sub>(미존재/축약)</sub>, `gifticon/ExpiryCheckScheduler.kt` <sub>(미존재/축약)</sub>, `inventory/InventoryJpaEntity.kt` <sub>(미존재/축약)</sub>, `inventory/InventoryReconciliationService.kt` <sub>(미존재/축약)</sub>, `inventory/OutboxPollingPublisher.kt` <sub>(미존재/축약)</sub>, `inventory/ReservationExpiryService.kt` <sub>(미존재/축약)</sub>, `order/KafkaConfig.kt` <sub>(미존재/축약)</sub>, `search/EsBulkDocumentProcessor.kt` <sub>(미존재/축약)</sub>, `quant/AuditChainVerifier.kt` <sub>(미존재/축약)</sub>, `quant/BithumbRestFallbackPoller.kt` <sub>(미존재/축약)</sub>, `quant/BithumbWebSocketSubscriber.kt` <sub>(미존재/축약)</sub>, `quant/ExchangeCredentialEntity.kt` <sub>(미존재/축약)</sub>, `quant/LazyReencryptionJob.kt` <sub>(미존재/축약)</sub>, `quant/MarketDataHub.kt` <sub>(미존재/축약)</sub>, `quant/NotificationDispatcher.kt` <sub>(미존재/축약)</sub>, `quant/OutboxPendingMetric.kt` <sub>(미존재/축약)</sub>, `quant/OutboxRelay.kt` <sub>(미존재/축약)</sub>, `quant/QuantMetrics.kt` <sub>(미존재/축약)</sub> |
| [3-java-kotlin-concurrency/07-executor-threadpool.md](3-java-kotlin-concurrency/07-executor-threadpool.md) | 3 | `gifticon/ExpiryCheckScheduler.kt` <sub>(미존재/축약)</sub>, `quant/BithumbWebSocketSubscriber.kt` <sub>(미존재/축약)</sub>, `quant/NotificationDispatcher.kt` <sub>(미존재/축약)</sub> |
| [3-java-kotlin-concurrency/08-concurrent-collections.md](3-java-kotlin-concurrency/08-concurrent-collections.md) | 3 | `auth/AuthService.kt` <sub>(미존재/축약)</sub>, `quant/MarketDataHub.kt` <sub>(미존재/축약)</sub>, `quant/QuantMetrics.kt` <sub>(미존재/축약)</sub> |
| [3-java-kotlin-concurrency/14-coroutine-internals.md](3-java-kotlin-concurrency/14-coroutine-internals.md) | 2 | `quant/ClickHouseAuditLogPublisher.kt` <sub>(미존재/축약)</sub>, `quant/NotificationDispatcher.kt` <sub>(미존재/축약)</sub> |
| [3-java-kotlin-concurrency/15-flow-channel.md](3-java-kotlin-concurrency/15-flow-channel.md) | 2 | `quant/MarketDataHub.kt` <sub>(미존재/축약)</sub>, `quant/MarketTickKafkaCollector.kt` <sub>(미존재/축약)</sub> |
| [3-java-kotlin-concurrency/16-structured-concurrency.md](3-java-kotlin-concurrency/16-structured-concurrency.md) | 2 | `quant/BithumbWebSocketSubscriber.kt` <sub>(미존재/축약)</sub>, `quant/NotificationDispatcher.kt` <sub>(미존재/축약)</sub> |
| [3-java-kotlin-concurrency/02-synchronized-monitor.md](3-java-kotlin-concurrency/02-synchronized-monitor.md) | 1 | `analytics/EventIngestionConsumer.kt` <sub>(미존재/축약)</sub> |
| [3-java-kotlin-concurrency/03-volatile-memory-visibility.md](3-java-kotlin-concurrency/03-volatile-memory-visibility.md) | 1 | `quant/OutboxRelay.kt` <sub>(미존재/축약)</sub> |
| [3-java-kotlin-concurrency/09-jmm-happens-before.md](3-java-kotlin-concurrency/09-jmm-happens-before.md) | 1 | `quant/BithumbWebSocketSubscriber.kt` <sub>(미존재/축약)</sub> |
| [3-java-kotlin-concurrency/17-virtual-threads.md](3-java-kotlin-concurrency/17-virtual-threads.md) | 1 | [`order/app/src/main/resources/application.yml`](../../order/app/src/main/resources/application.yml) |
| [3-java-kotlin-concurrency/21-profiling-tools.md](3-java-kotlin-concurrency/21-profiling-tools.md) | 1 | `analytics/EventIngestionConsumer.kt` <sub>(미존재/축약)</sub> |
| [3-java-kotlin-concurrency/23-improvements.md](3-java-kotlin-concurrency/23-improvements.md) | 1 | `auth/AuthService.kt` <sub>(미존재/축약)</sub> |

### #4 DB Index/Transaction

_총 2 개 학습 노트, 4 건 인용_

| 학습 노트 | 인용 path 수 | 인용된 msa path |
|---|---:|---|
| [4-db-index-transaction/00-plan.md](4-db-index-transaction/00-plan.md) | 2 | [`docs/adr/ADR-0006-database-strategy.md`](../../docs/adr/ADR-0006-database-strategy.md), [`docs/adr/ADR-0020-transactional-usage.md`](../../docs/adr/ADR-0020-transactional-usage.md) |
| [4-db-index-transaction/03-clustered-vs-secondary.md](4-db-index-transaction/03-clustered-vs-secondary.md) | 2 | `order/V1__create_orders_table.sql` <sub>(미존재/축약)</sub>, `product/V1__create_products_table.sql` <sub>(미존재/축약)</sub> |

### #5 Spring @Transactional

_총 8 개 학습 노트, 11 건 인용_

| 학습 노트 | 인용 path 수 | 인용된 msa path |
|---|---:|---|
| [5-spring-transactional/00-plan.md](5-spring-transactional/00-plan.md) | 2 | [`docs/adr/ADR-0020-transactional-usage.md`](../../docs/adr/ADR-0020-transactional-usage.md), [`docs/adr/ADR-0022-entity-mutation-conventions.md`](../../docs/adr/ADR-0022-entity-mutation-conventions.md) |
| [5-spring-transactional/01-aop-proxy-basics.md](5-spring-transactional/01-aop-proxy-basics.md) | 2 | [`build.gradle.kts`](../../build.gradle.kts), [`docs/conventions/transactional-usage.md`](../../docs/conventions/transactional-usage.md) |
| [5-spring-transactional/11-msa-mapping.md](5-spring-transactional/11-msa-mapping.md) | 2 | [`docs/conventions/entity-mutation.md`](../../docs/conventions/entity-mutation.md), [`docs/conventions/transactional-usage.md`](../../docs/conventions/transactional-usage.md) |
| [5-spring-transactional/02-default-rollback-rules.md](5-spring-transactional/02-default-rollback-rules.md) | 1 | `common/exception/BusinessException.kt` <sub>(미존재/축약)</sub> |
| [5-spring-transactional/03-self-invocation.md](5-spring-transactional/03-self-invocation.md) | 1 | [`docs/conventions/code-convention.md`](../../docs/conventions/code-convention.md) |
| [5-spring-transactional/06-readonly-vs-writable.md](5-spring-transactional/06-readonly-vs-writable.md) | 1 | [`docs/conventions/transactional-usage.md`](../../docs/conventions/transactional-usage.md) |
| [5-spring-transactional/07-replica-routing-pattern.md](5-spring-transactional/07-replica-routing-pattern.md) | 1 | `product/app/src/main/kotlin/com/kgd/product/infrastructure/config/DataSourceConfig.kt` <sub>(미존재/축약)</sub> |
| [5-spring-transactional/08-class-level-pitfalls.md](5-spring-transactional/08-class-level-pitfalls.md) | 1 | [`docs/conventions/transactional-usage.md`](../../docs/conventions/transactional-usage.md) |

### #6 Kafka Internals

_총 6 개 학습 노트, 16 건 인용_

| 학습 노트 | 인용 path 수 | 인용된 msa path |
|---|---:|---|
| [6-kafka-internals/11-msa-codebase-grep.md](6-kafka-internals/11-msa-codebase-grep.md) | 7 | [`docs/architecture/kafka-convention.md`](../../docs/architecture/kafka-convention.md), [`inventory/app/src/main/kotlin/com/kgd/inventory/infrastructure/config/KafkaConfig.kt`](../../inventory/app/src/main/kotlin/com/kgd/inventory/infrastructure/config/KafkaConfig.kt), [`k8s/infra/local/kafka/statefulset.yaml`](../../k8s/infra/local/kafka/statefulset.yaml), [`k8s/infra/prod/strimzi/kafka-cluster.yaml`](../../k8s/infra/prod/strimzi/kafka-cluster.yaml), [`k8s/infra/prod/strimzi/kafka-topics.yaml`](../../k8s/infra/prod/strimzi/kafka-topics.yaml), `order/app/src/main/kotlin/com/kgd/order/infrastructure/config/KafkaConfig.kt` <sub>(미존재/축약)</sub>, [`order/app/src/main/resources/application.yml`](../../order/app/src/main/resources/application.yml) |
| [6-kafka-internals/00-plan.md](6-kafka-internals/00-plan.md) | 3 | [`docs/adr/ADR-0012-idempotent-consumer.md`](../../docs/adr/ADR-0012-idempotent-consumer.md), [`docs/adr/ADR-0015-resilience-strategy.md`](../../docs/adr/ADR-0015-resilience-strategy.md), [`docs/architecture/kafka-convention.md`](../../docs/architecture/kafka-convention.md) |
| [6-kafka-internals/03-controller-kraft.md](6-kafka-internals/03-controller-kraft.md) | 2 | [`k8s/infra/local/kafka/statefulset.yaml`](../../k8s/infra/local/kafka/statefulset.yaml), [`k8s/infra/prod/strimzi/kafka-cluster.yaml`](../../k8s/infra/prod/strimzi/kafka-cluster.yaml) |
| [6-kafka-internals/06-replication-isr.md](6-kafka-internals/06-replication-isr.md) | 2 | [`k8s/infra/prod/strimzi/kafka-cluster.yaml`](../../k8s/infra/prod/strimzi/kafka-cluster.yaml), [`k8s/infra/prod/strimzi/kafka-topics.yaml`](../../k8s/infra/prod/strimzi/kafka-topics.yaml) |
| [6-kafka-internals/01-broker-topic-partition.md](6-kafka-internals/01-broker-topic-partition.md) | 1 | [`k8s/infra/prod/strimzi/kafka-topics.yaml`](../../k8s/infra/prod/strimzi/kafka-topics.yaml) |
| [6-kafka-internals/13-improvements.md](6-kafka-internals/13-improvements.md) | 1 | `common/kafka/IdempotentEventHandler.kt` <sub>(미존재/축약)</sub> |

### #7 Distributed Systems

_총 9 개 학습 노트, 15 건 인용_

| 학습 노트 | 인용 path 수 | 인용된 msa path |
|---|---:|---|
| [7-distributed-systems/00-plan.md](7-distributed-systems/00-plan.md) | 5 | [`docs/adr/ADR-0011-inventory-fulfillment-service.md`](../../docs/adr/ADR-0011-inventory-fulfillment-service.md), [`docs/adr/ADR-0012-idempotent-consumer.md`](../../docs/adr/ADR-0012-idempotent-consumer.md), [`docs/adr/ADR-0013-product-inventory-ssot.md`](../../docs/adr/ADR-0013-product-inventory-ssot.md), [`docs/adr/ADR-0015-resilience-strategy.md`](../../docs/adr/ADR-0015-resilience-strategy.md), [`docs/architecture/resilience-strategy.md`](../../docs/architecture/resilience-strategy.md) |
| [7-distributed-systems/12-bulkhead-ratelimit.md](7-distributed-systems/12-bulkhead-ratelimit.md) | 2 | [`gateway/src/main/kotlin/com/kgd/gateway/config/GatewayRouteConfig.kt`](../../gateway/src/main/kotlin/com/kgd/gateway/config/GatewayRouteConfig.kt), [`gateway/src/main/kotlin/com/kgd/gateway/config/RateLimiterConfig.kt`](../../gateway/src/main/kotlin/com/kgd/gateway/config/RateLimiterConfig.kt) |
| [7-distributed-systems/16-codebase-saga.md](7-distributed-systems/16-codebase-saga.md) | 2 | `fulfillment/service/FulfillmentService.kt` <sub>(미존재/축약)</sub>, `inventory/service/InventoryService.kt` <sub>(미존재/축약)</sub> |
| [7-distributed-systems/01-distributed-fundamentals.md](7-distributed-systems/01-distributed-fundamentals.md) | 1 | `order/PaymentAdapter.kt` <sub>(미존재/축약)</sub> |
| [7-distributed-systems/09-idempotency.md](7-distributed-systems/09-idempotency.md) | 1 | `inventory/InventoryEventConsumer.kt` <sub>(미존재/축약)</sub> |
| [7-distributed-systems/11-circuit-breaker.md](7-distributed-systems/11-circuit-breaker.md) | 1 | `order/WebClientConfig.kt` <sub>(미존재/축약)</sub> |
| [7-distributed-systems/14-outbox-inbox-cdc.md](7-distributed-systems/14-outbox-inbox-cdc.md) | 1 | `fulfillment/OutboxPollingPublisher.kt` <sub>(미존재/축약)</sub> |
| [7-distributed-systems/17-codebase-idempotent-ssot.md](7-distributed-systems/17-codebase-idempotent-ssot.md) | 1 | `inventory/InventoryEventConsumer.kt` <sub>(미존재/축약)</sub> |
| [7-distributed-systems/19-improvements.md](7-distributed-systems/19-improvements.md) | 1 | `common/src/main/kotlin/com/kgd/common/messaging/IdempotentEventHandler.kt` <sub>(미존재/축약)</sub> |

### #8 System Design

_총 2 개 학습 노트, 3 건 인용_

| 학습 노트 | 인용 path 수 | 인용된 msa path |
|---|---:|---|
| [8-system-design/06-rate-limiter.md](8-system-design/06-rate-limiter.md) | 2 | `gateway/RateLimiterConfig.kt` <sub>(미존재/축약)</sub>, [`gateway/src/main/kotlin/com/kgd/gateway/config/RateLimiterConfig.kt`](../../gateway/src/main/kotlin/com/kgd/gateway/config/RateLimiterConfig.kt) |
| [8-system-design/00-preview.md](8-system-design/00-preview.md) | 1 | `gateway/RateLimiterConfig.kt` <sub>(미존재/축약)</sub> |

### #9 Redis Deep Dive

_총 8 개 학습 노트, 17 건 인용_

| 학습 노트 | 인용 path 수 | 인용된 msa path |
|---|---:|---|
| [9-redis-deep-dive/17-msa-application.md](9-redis-deep-dive/17-msa-application.md) | 5 | [`common/src/main/kotlin/com/kgd/common/redis/CommonRedisAutoConfiguration.kt`](../../common/src/main/kotlin/com/kgd/common/redis/CommonRedisAutoConfiguration.kt), [`gateway/src/main/kotlin/com/kgd/gateway/config/RateLimiterConfig.kt`](../../gateway/src/main/kotlin/com/kgd/gateway/config/RateLimiterConfig.kt), [`k8s/infra/prod/redis/values.yaml`](../../k8s/infra/prod/redis/values.yaml), [`k8s/overlays/k3s-lite/patches/redis-standalone-product.yaml`](../../k8s/overlays/k3s-lite/patches/redis-standalone-product.yaml), [`quant/app/src/main/kotlin/com/kgd/quant/infrastructure/resilience/RedisTokenBucketRateLimiter.kt`](../../quant/app/src/main/kotlin/com/kgd/quant/infrastructure/resilience/RedisTokenBucketRateLimiter.kt) |
| [9-redis-deep-dive/09-cluster-slots.md](9-redis-deep-dive/09-cluster-slots.md) | 3 | `common/CommonRedisAutoConfiguration.kt` <sub>(미존재/축약)</sub>, [`k8s/infra/prod/redis/values.yaml`](../../k8s/infra/prod/redis/values.yaml), [`k8s/overlays/k3s-lite/patches/redis-standalone-product.yaml`](../../k8s/overlays/k3s-lite/patches/redis-standalone-product.yaml) |
| [9-redis-deep-dive/18-improvements.md](9-redis-deep-dive/18-improvements.md) | 3 | `analytics/ScoreCacheAdapter.kt` <sub>(미존재/축약)</sub>, [`k8s/infra/local/redis/statefulset.yaml`](../../k8s/infra/local/redis/statefulset.yaml), [`k8s/infra/prod/redis/values.yaml`](../../k8s/infra/prod/redis/values.yaml) |
| [9-redis-deep-dive/07-aof-persistence.md](9-redis-deep-dive/07-aof-persistence.md) | 2 | [`k8s/infra/local/redis/statefulset.yaml`](../../k8s/infra/local/redis/statefulset.yaml), [`k8s/infra/prod/redis/values.yaml`](../../k8s/infra/prod/redis/values.yaml) |
| [9-redis-deep-dive/00-preview.md](9-redis-deep-dive/00-preview.md) | 1 | [`k8s/infra/prod/redis/values.yaml`](../../k8s/infra/prod/redis/values.yaml) |
| [9-redis-deep-dive/05-ttl-and-eviction.md](9-redis-deep-dive/05-ttl-and-eviction.md) | 1 | [`k8s/infra/local/redis/statefulset.yaml`](../../k8s/infra/local/redis/statefulset.yaml) |
| [9-redis-deep-dive/06-rdb-persistence.md](9-redis-deep-dive/06-rdb-persistence.md) | 1 | [`k8s/infra/local/redis/statefulset.yaml`](../../k8s/infra/local/redis/statefulset.yaml) |
| [9-redis-deep-dive/16-memory-and-pitfalls.md](9-redis-deep-dive/16-memory-and-pitfalls.md) | 1 | [`k8s/infra/local/redis/statefulset.yaml`](../../k8s/infra/local/redis/statefulset.yaml) |

### 루트 (00-INDEX 등)

_총 3 개 학습 노트, 74 건 인용_

| 학습 노트 | 인용 path 수 | 인용된 msa path |
|---|---:|---|
| [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md) | 65 | `analytics/ScoreCacheAdapter.kt` <sub>(미존재/축약)</sub>, `auth/AuthService.kt` <sub>(미존재/축약)</sub>, [`build.gradle.kts`](../../build.gradle.kts), `common/application-actuator.yml` <sub>(미존재/축약)</sub>, [`common/build.gradle.kts`](../../common/build.gradle.kts), `common/src/main/kotlin/com/kgd/common/cache/StampedeGuardedCache.kt` <sub>(미존재/축약)</sub>, `common/src/main/kotlin/com/kgd/common/cache/TtlJitter.kt` <sub>(미존재/축약)</sub>, `common/src/main/kotlin/com/kgd/common/datasource/CommonDataSourceAutoConfiguration.kt` <sub>(미존재/축약)</sub>, `common/src/main/kotlin/com/kgd/common/datasource/RoutingDataSource.kt` <sub>(미존재/축약)</sub>, `common/src/main/kotlin/com/kgd/common/datasource/Stickiness.kt` <sub>(미존재/축약)</sub>, `common/src/main/kotlin/com/kgd/common/datasource/WriteEvent.kt` <sub>(미존재/축약)</sub>, [`common/src/main/kotlin/com/kgd/common/exception/ErrorCode.kt`](../../common/src/main/kotlin/com/kgd/common/exception/ErrorCode.kt), [`common/src/main/kotlin/com/kgd/common/jackson/CommonJacksonAutoConfiguration.kt`](../../common/src/main/kotlin/com/kgd/common/jackson/CommonJacksonAutoConfiguration.kt), `common/src/main/kotlin/com/kgd/common/lock/DistributedLock.kt` <sub>(미존재/축약)</sub>, `common/src/main/kotlin/com/kgd/common/messaging/IdempotentEventHandler.kt` <sub>(미존재/축약)</sub>, `common/src/main/kotlin/com/kgd/common/messaging/ProcessedEventRepositoryPort.kt` <sub>(미존재/축약)</sub>, `common/src/main/kotlin/com/kgd/common/observability/TraceIdFilter.kt` <sub>(미존재/축약)</sub>, [`common/src/main/kotlin/com/kgd/common/redis/CommonRedisAutoConfiguration.kt`](../../common/src/main/kotlin/com/kgd/common/redis/CommonRedisAutoConfiguration.kt), `common/src/main/kotlin/com/kgd/common/web/IdempotencyAspect.kt` <sub>(미존재/축약)</sub>, `common/src/main/kotlin/com/kgd/common/web/Idempotent.kt` <sub>(미존재/축약)</sub>, `common/src/main/resources/application-actuator.yml` <sub>(미존재/축약)</sub>, [`docs/adr/ADR-0002-language-and-framework.md`](../../docs/adr/ADR-0002-language-and-framework.md), [`docs/adr/ADR-0003-inter-service-communication.md`](../../docs/adr/ADR-0003-inter-service-communication.md), [`docs/adr/ADR-0011-inventory-fulfillment-service.md`](../../docs/adr/ADR-0011-inventory-fulfillment-service.md), [`docs/adr/ADR-0012-idempotent-consumer.md`](../../docs/adr/ADR-0012-idempotent-consumer.md), [`docs/adr/ADR-0015-resilience-strategy.md`](../../docs/adr/ADR-0015-resilience-strategy.md), `docs/conventions/api-idempotency.md` <sub>(미존재/축약)</sub>, `docs/conventions/distributed-lock.md` <sub>(미존재/축약)</sub>, `docs/conventions/gitops.md` <sub>(미존재/축약)</sub>, `docs/conventions/hpa-sizing.md` <sub>(미존재/축약)</sub>, [`docs/conventions/logging.md`](../../docs/conventions/logging.md), `docs/conventions/network-policy.md` <sub>(미존재/축약)</sub>, `docs/conventions/redis-keys.md` <sub>(미존재/축약)</sub>, `docs/conventions/response-compression.md` <sub>(미존재/축약)</sub>, `docs/conventions/secret-management.md` <sub>(미존재/축약)</sub>, `gateway/app/src/main/kotlin/com/kgd/gateway/config/RateLimiterConfig.kt` <sub>(미존재/축약)</sub>, `gateway/app/src/main/kotlin/com/kgd/gateway/config/RouteConfig.kt` <sub>(미존재/축약)</sub>, `gateway/app/src/main/kotlin/com/kgd/gateway/filter/TieredRateLimiter.kt` <sub>(미존재/축약)</sub>, `gateway/app/src/main/kotlin/com/kgd/gateway/web/FallbackController.kt` <sub>(미존재/축약)</sub>, `gateway/app/src/main/resources/application.yml` <sub>(미존재/축약)</sub>, [`gateway/build.gradle.kts`](../../gateway/build.gradle.kts), `gateway/ingress-private.yaml` <sub>(미존재/축약)</sub>, `gateway/rollout.yaml` <sub>(미존재/축약)</sub>, `inventory/app/src/main/kotlin/com/kgd/inventory/inventory/persistence/InventoryJpaEntity.kt` <sub>(미존재/축약)</sub>, `inventory/app/src/main/kotlin/com/kgd/inventory/inventory/persistence/InventoryJpaRepository.kt` <sub>(미존재/축약)</sub>, `inventory/app/src/main/kotlin/com/kgd/inventory/inventory/service/ReservationService.kt` <sub>(미존재/축약)</sub>, `k8s/base/gateway/ingress-private.yaml` <sub>(미존재/축약)</sub>, `k8s/base/namespace-pss.yaml` <sub>(미존재/축약)</sub>, `k8s/base/network-policy/default-deny.yaml` <sub>(미존재/축약)</sub>, `k8s/infra/local/ingress-nginx/values.yaml` <sub>(미존재/축약)</sub>, [`k8s/infra/local/redis/statefulset.yaml`](../../k8s/infra/local/redis/statefulset.yaml), `k8s/infra/prod/argo-rollouts/analysis-templates/latency-p99.yaml` <sub>(미존재/축약)</sub>, `k8s/infra/prod/argo-rollouts/analysis-templates/success-rate.yaml` <sub>(미존재/축약)</sub>, `k8s/infra/prod/argocd/values.yaml` <sub>(미존재/축약)</sub>, `k8s/infra/prod/monitoring/grafana/datasources/loki.yaml` <sub>(미존재/축약)</sub>, `k8s/infra/prod/monitoring/jvm-alerts.yaml` <sub>(미존재/축약)</sub>, `k8s/infra/prod/monitoring/loki/values.yaml` <sub>(미존재/축약)</sub>, `k8s/infra/prod/monitoring/promtail/values.yaml` <sub>(미존재/축약)</sub>, [`k8s/infra/prod/redis/values.yaml`](../../k8s/infra/prod/redis/values.yaml), `k8s/overlays/prod-k8s/gateway/rollout.yaml` <sub>(미존재/축약)</sub>, `k8s/overlays/prod-k8s/keda/scaledobject-analytics.yaml` <sub>(미존재/축약)</sub>, `k8s/overlays/prod-k8s/keda/scaledobject-search-consumer.yaml` <sub>(미존재/축약)</sub>, `k8s/overlays/prod-k8s/order/rollout.yaml` <sub>(미존재/축약)</sub>, `k8s/overlays/prod-k8s/patches/topology-spread.yaml` <sub>(미존재/축약)</sub>, `order/rollout.yaml` <sub>(미존재/축약)</sub> |
| [00-INDEX.md](00-INDEX.md) | 7 | `common/datasource/Stickiness.kt` <sub>(미존재/축약)</sub>, `common/security/JwtUtil.kt` <sub>(미존재/축약)</sub>, [`docs/adr/ADR-0012-idempotent-consumer.md`](../../docs/adr/ADR-0012-idempotent-consumer.md), [`docs/adr/ADR-0015-resilience-strategy.md`](../../docs/adr/ADR-0015-resilience-strategy.md), [`docs/adr/ADR-0019-k8s-migration.md`](../../docs/adr/ADR-0019-k8s-migration.md), [`docs/adr/ADR-0020-transactional-usage.md`](../../docs/adr/ADR-0020-transactional-usage.md), [`k8s/base/frontend-ingress.yaml`](../../k8s/base/frontend-ingress.yaml) |
| [00-LEARNING-GUIDE.md](00-LEARNING-GUIDE.md) | 2 | [`docs/architecture/kafka-convention.md`](../../docs/architecture/kafka-convention.md), `order/app/...IdempotentEventListener.kt` <sub>(미존재/축약)</sub> |

---

## §7 사용 시나리오

**Q1. `ProductService.kt` 류 product 도메인 클래스를 리팩터링하려는데 영향받는 학습 노트는?**
→ §2 `product` 표 검색. 해당 경로의 "인용 학습 노트" 컬럼이 갱신 대상.

**Q2. ADR-0012 (idempotent-consumer) 를 supersede 하면 어느 학습 노트가 영향받는가?**
→ §3 ADR 표에서 `ADR-0012-idempotent-consumer.md` 행을 보고 인용 학습 노트 모두 갱신.

**Q3. `common` 모듈 변경 영향 범위?**
→ §2 `common` 섹션 + §5 `common` 인용 합계로 영향 정량화.

**Q4. K8s overlay 구조 변경 (예: Strimzi → Helm)**
→ §2.5 K8s 표에서 `k8s/infra/prod/strimzi/...` 경로의 인용 학습 노트 동기화.

**Q5. `application.yml` (특정 서비스) 옵션 변경**
→ §2 해당 서비스 섹션에서 `kind=config` 행만 필터.

**Q6. JWT/암호화 관련 코드 변경 (`common/security/...`)**
→ §2 `common` 표에서 해당 경로 검색 → 거의 모두 13장(`13-crypto-jwt-sso/`) 학습 노트로 연결.

**Q7. 학습 노트 한 편 (`12-latency-numbers/05-tail-and-fanout.md`) 갱신 전 의존 코드 확인?**
→ §6 Forward Index 의 #12 토픽 표에서 해당 노트 행 → 인용된 path 가 여전히 유효한지 1차 검증.

**Q8. 신규 토픽 학습 시작 전, 기존 토픽들이 어느 코드를 가장 많이 다뤘는지 파악?**
→ §6 "토픽별 통계" 표에서 인용 path 수 desc 로 정렬.

**Q9. quant 신규 구현 (현재 축약 path 다수) → 실제 path 확정 후?**
→ §2 `quant` 표에서 `(미존재/축약)` 항목을 실 구현 path 로 학습 노트 일괄 치환 작업 항목 도출.

---

## §8 운영 메모

- **재생성**: 이 문서는 `study/docs/` 전수 grep 기반 자동 생성. 새 학습 노트 추가 / 코드 인용 갱신 시 재생성 권장.
- **축약 경로 처리 정책**: 학습 노트 작성자가 의도적으로 짧게 표기한 경로(예: `quant/BithumbWebSocketSubscriber.kt`)는 실제 파일이 없더라도 보존. 추후 실 구현 시 정확한 path 로 학습 노트 갱신 가능.
- **Top 50 / By Service / Infra & Build / ADR / Convention / Forward Index** 섹션은 서로 중복(같은 path 가 여러 섹션에 등장)될 수 있음 — 의도된 동작.
- **doc-index 와의 관계**: `docs/doc-index.json` 은 "코드 → 어떤 docs 가 설명하는가" 였다면, 본 문서는 "코드/docs → 어떤 학습 노트가 인용하는가". 보완 관계.
- **link 검증**: 본 문서는 정적 분석 결과이므로, 링크가 깨질 수 있음 (파일 이동/삭제). 주기적으로 `/hns:gc` 또는 doc-link checker 로 점검.
- **toc 앵커**: GitHub-flavored Markdown 의 자동 anchor 규칙(소문자, 공백→`-`, 특수문자 제거)에 의존. 한국어 헤더는 anchor 가 한글 그대로 유지됨.
- **재현 방법**: 본 인덱스는 `study/docs/**/*.md` 를 정규식으로 grep → 분류 → 그룹화 → 마크다운 렌더링. 정규식은 본 파일 §2 의 서비스 prefix 목록 + 확장자 화이트리스트 기반.

---

## Appendix A — 가장 많이 인용한 학습 노트 Top 20

어느 학습 노트가 코드를 가장 많이 인용했는가 (즉 해당 노트가 깨질 위험이 가장 높음).

| Rank | 학습 노트 | 인용 path 수 |
|---:|---|---:|
| 1 | [00-ADR-CANDIDATES.md](00-ADR-CANDIDATES.md) | 65 |
| 2 | [3-java-kotlin-concurrency/22-msa-concurrency-patterns.md](3-java-kotlin-concurrency/22-msa-concurrency-patterns.md) | 21 |
| 3 | [00-INDEX.md](00-INDEX.md) | 7 |
| 4 | [10-observability/12-msa-current-state.md](10-observability/12-msa-current-state.md) | 7 |
| 5 | [10-observability/13-improvements.md](10-observability/13-improvements.md) | 7 |
| 6 | [13-crypto-jwt-sso/00-plan.md](13-crypto-jwt-sso/00-plan.md) | 7 |
| 7 | [6-kafka-internals/11-msa-codebase-grep.md](6-kafka-internals/11-msa-codebase-grep.md) | 7 |
| 8 | [15-connection-pool/15-codebase-audit.md](15-connection-pool/15-codebase-audit.md) | 6 |
| 9 | [15-connection-pool/17-improvements.md](15-connection-pool/17-improvements.md) | 6 |
| 10 | [15-connection-pool/18-interview-qa.md](15-connection-pool/18-interview-qa.md) | 6 |
| 11 | [11-k8s-deep-dive/02-core-resources.md](11-k8s-deep-dive/02-core-resources.md) | 5 |
| 12 | [11-k8s-deep-dive/15-msa-k8s-grep.md](11-k8s-deep-dive/15-msa-k8s-grep.md) | 5 |
| 13 | [16-async-nonblocking-io/17-http-client-tradeoffs.md](16-async-nonblocking-io/17-http-client-tradeoffs.md) | 5 |
| 14 | [17-spring-web/17-msa-gateway-filter.md](17-spring-web/17-msa-gateway-filter.md) | 5 |
| 15 | [17-spring-web/19-improvements.md](17-spring-web/19-improvements.md) | 5 |
| 16 | [18-grpc/18-virtual-migration-product.md](18-grpc/18-virtual-migration-product.md) | 5 |
| 17 | [2-jvm-gc/18-msa-jib-config.md](2-jvm-gc/18-msa-jib-config.md) | 5 |
| 18 | [7-distributed-systems/00-plan.md](7-distributed-systems/00-plan.md) | 5 |
| 19 | [9-redis-deep-dive/17-msa-application.md](9-redis-deep-dive/17-msa-application.md) | 5 |
| 20 | [1-aws-network/17-msa-mapping.md](1-aws-network/17-msa-mapping.md) | 4 |

## Appendix B — 인용 0건 학습 노트 (참고)

코드 grounding 인용이 추출되지 않은 학습 노트 (자동 추출 규칙 한계로 누락되었을 수도, 실제 코드 인용이 없는 순수 개념 노트일 수도 있음).

_총 233 개 (전체 362 중)_

<details><summary>#1 AWS Network (15 개)</summary>

- [1-aws-network/00-preview.md](1-aws-network/00-preview.md)
- [1-aws-network/02-subnet.md](1-aws-network/02-subnet.md)
- [1-aws-network/03-igw.md](1-aws-network/03-igw.md)
- [1-aws-network/04-route-table.md](1-aws-network/04-route-table.md)
- [1-aws-network/05-security-group.md](1-aws-network/05-security-group.md)
- [1-aws-network/06-nacl.md](1-aws-network/06-nacl.md)
- [1-aws-network/07-nat-gateway.md](1-aws-network/07-nat-gateway.md)
- [1-aws-network/08-eip.md](1-aws-network/08-eip.md)
- [1-aws-network/10-nlb.md](1-aws-network/10-nlb.md)
- [1-aws-network/11-vpc-endpoint.md](1-aws-network/11-vpc-endpoint.md)
- [1-aws-network/12-vpc-interconnect.md](1-aws-network/12-vpc-interconnect.md)
- [1-aws-network/15-route53.md](1-aws-network/15-route53.md)
- [1-aws-network/16-terraform-cdk.md](1-aws-network/16-terraform-cdk.md)
- [1-aws-network/18-improvements.md](1-aws-network/18-improvements.md)
- [1-aws-network/19-interview-qa.md](1-aws-network/19-interview-qa.md)

</details>

<details><summary>#10 Observability (6 개)</summary>

- [10-observability/00-preview.md](10-observability/00-preview.md)
- [10-observability/03-metric-types-and-cardinality.md](10-observability/03-metric-types-and-cardinality.md)
- [10-observability/04-promql-and-alerting.md](10-observability/04-promql-and-alerting.md)
- [10-observability/09-sampling-and-correlation.md](10-observability/09-sampling-and-correlation.md)
- [10-observability/10-slo-sli-error-budget.md](10-observability/10-slo-sli-error-budget.md)
- [10-observability/11-ebpf-profiling-pyroscope.md](10-observability/11-ebpf-profiling-pyroscope.md)

</details>

<details><summary>#11 K8s Deep Dive (8 개)</summary>

- [11-k8s-deep-dive/00-preview.md](11-k8s-deep-dive/00-preview.md)
- [11-k8s-deep-dive/01-control-plane.md](11-k8s-deep-dive/01-control-plane.md)
- [11-k8s-deep-dive/03-controller-pattern.md](11-k8s-deep-dive/03-controller-pattern.md)
- [11-k8s-deep-dive/04-crd-operator.md](11-k8s-deep-dive/04-crd-operator.md)
- [11-k8s-deep-dive/05-networking-deep.md](11-k8s-deep-dive/05-networking-deep.md)
- [11-k8s-deep-dive/12-gitops.md](11-k8s-deep-dive/12-gitops.md)
- [11-k8s-deep-dive/13-service-mesh.md](11-k8s-deep-dive/13-service-mesh.md)
- [11-k8s-deep-dive/17-interview-qa.md](11-k8s-deep-dive/17-interview-qa.md)

</details>

<details><summary>#12 Latency Numbers (9 개)</summary>

- [12-latency-numbers/01-orders-of-magnitude-map.md](12-latency-numbers/01-orders-of-magnitude-map.md)
- [12-latency-numbers/02-cpu-cache.md](12-latency-numbers/02-cpu-cache.md)
- [12-latency-numbers/03-memory-vs-storage.md](12-latency-numbers/03-memory-vs-storage.md)
- [12-latency-numbers/04-network-physics.md](12-latency-numbers/04-network-physics.md)
- [12-latency-numbers/06-baseline-measurement.md](12-latency-numbers/06-baseline-measurement.md)
- [12-latency-numbers/07-load-test-tail.md](12-latency-numbers/07-load-test-tail.md)
- [12-latency-numbers/09-msa-call-budget.md](12-latency-numbers/09-msa-call-budget.md)
- [12-latency-numbers/10-pitfalls.md](12-latency-numbers/10-pitfalls.md)
- [12-latency-numbers/11-interview-qa.md](12-latency-numbers/11-interview-qa.md)

</details>

<details><summary>#13 Crypto/JWT/SSO (20 개)</summary>

- [13-crypto-jwt-sso/00-preview.md](13-crypto-jwt-sso/00-preview.md)
- [13-crypto-jwt-sso/01-symmetric-vs-asymmetric.md](13-crypto-jwt-sso/01-symmetric-vs-asymmetric.md)
- [13-crypto-jwt-sso/03-aes-internals.md](13-crypto-jwt-sso/03-aes-internals.md)
- [13-crypto-jwt-sso/04-hash-functions.md](13-crypto-jwt-sso/04-hash-functions.md)
- [13-crypto-jwt-sso/05-password-hashing.md](13-crypto-jwt-sso/05-password-hashing.md)
- [13-crypto-jwt-sso/06-hmac.md](13-crypto-jwt-sso/06-hmac.md)
- [13-crypto-jwt-sso/07-asymmetric-signing.md](13-crypto-jwt-sso/07-asymmetric-signing.md)
- [13-crypto-jwt-sso/08-jwt-structure.md](13-crypto-jwt-sso/08-jwt-structure.md)
- [13-crypto-jwt-sso/09-token-strategy.md](13-crypto-jwt-sso/09-token-strategy.md)
- [13-crypto-jwt-sso/10-oauth2.md](13-crypto-jwt-sso/10-oauth2.md)
- [13-crypto-jwt-sso/11-oidc.md](13-crypto-jwt-sso/11-oidc.md)
- [13-crypto-jwt-sso/12-saml.md](13-crypto-jwt-sso/12-saml.md)
- [13-crypto-jwt-sso/13-aws-kms.md](13-crypto-jwt-sso/13-aws-kms.md)
- [13-crypto-jwt-sso/14-multi-cloud-kms.md](13-crypto-jwt-sso/14-multi-cloud-kms.md)
- [13-crypto-jwt-sso/15-hsm.md](13-crypto-jwt-sso/15-hsm.md)
- [13-crypto-jwt-sso/16-tls.md](13-crypto-jwt-sso/16-tls.md)
- [13-crypto-jwt-sso/17-mtls.md](13-crypto-jwt-sso/17-mtls.md)
- [13-crypto-jwt-sso/18-code-refactoring.md](13-crypto-jwt-sso/18-code-refactoring.md)
- [13-crypto-jwt-sso/19-improvements.md](13-crypto-jwt-sso/19-improvements.md)
- [13-crypto-jwt-sso/20-interview-qa.md](13-crypto-jwt-sso/20-interview-qa.md)

</details>

<details><summary>#14 CRDT/MRDT (20 개)</summary>

- [14-crdt-mrdt/00-plan.md](14-crdt-mrdt/00-plan.md)
- [14-crdt-mrdt/00-preview.md](14-crdt-mrdt/00-preview.md)
- [14-crdt-mrdt/01-distributed-conflict.md](14-crdt-mrdt/01-distributed-conflict.md)
- [14-crdt-mrdt/02-sec-semilattice.md](14-crdt-mrdt/02-sec-semilattice.md)
- [14-crdt-mrdt/03-cvrdt-vs-cmrdt.md](14-crdt-mrdt/03-cvrdt-vs-cmrdt.md)
- [14-crdt-mrdt/04-counter-crdts.md](14-crdt-mrdt/04-counter-crdts.md)
- [14-crdt-mrdt/05-set-crdts.md](14-crdt-mrdt/05-set-crdts.md)
- [14-crdt-mrdt/06-register-crdts.md](14-crdt-mrdt/06-register-crdts.md)
- [14-crdt-mrdt/07-map-crdts.md](14-crdt-mrdt/07-map-crdts.md)
- [14-crdt-mrdt/08-sequence-crdts.md](14-crdt-mrdt/08-sequence-crdts.md)
- [14-crdt-mrdt/09-json-crdts.md](14-crdt-mrdt/09-json-crdts.md)
- [14-crdt-mrdt/10-causal-context.md](14-crdt-mrdt/10-causal-context.md)
- [14-crdt-mrdt/11-delta-crdt.md](14-crdt-mrdt/11-delta-crdt.md)
- [14-crdt-mrdt/12-garbage-collection.md](14-crdt-mrdt/12-garbage-collection.md)
- [14-crdt-mrdt/13-mrdt.md](14-crdt-mrdt/13-mrdt.md)
- [14-crdt-mrdt/14-crdt-vs-ot.md](14-crdt-mrdt/14-crdt-vs-ot.md)
- [14-crdt-mrdt/15-byzantine-bft.md](14-crdt-mrdt/15-byzantine-bft.md)
- [14-crdt-mrdt/16-real-systems.md](14-crdt-mrdt/16-real-systems.md)
- [14-crdt-mrdt/18-improvements.md](14-crdt-mrdt/18-improvements.md)
- [14-crdt-mrdt/19-interview-qa.md](14-crdt-mrdt/19-interview-qa.md)

</details>

<details><summary>#15 Connection Pool (6 개)</summary>

- [15-connection-pool/02-pool-parameters.md](15-connection-pool/02-pool-parameters.md)
- [15-connection-pool/04-hikari-concurrent-bag.md](15-connection-pool/04-hikari-concurrent-bag.md)
- [15-connection-pool/05-hikari-fastlist-proxy.md](15-connection-pool/05-hikari-fastlist-proxy.md)
- [15-connection-pool/06-hikari-housekeeper.md](15-connection-pool/06-hikari-housekeeper.md)
- [15-connection-pool/07-pool-sizing.md](15-connection-pool/07-pool-sizing.md)
- [15-connection-pool/14-observability.md](15-connection-pool/14-observability.md)

</details>

<details><summary>#16 Async/Non-blocking IO (14 개)</summary>

- [16-async-nonblocking-io/00-plan.md](16-async-nonblocking-io/00-plan.md)
- [16-async-nonblocking-io/00-preview.md](16-async-nonblocking-io/00-preview.md)
- [16-async-nonblocking-io/01-c10k-problem.md](16-async-nonblocking-io/01-c10k-problem.md)
- [16-async-nonblocking-io/02-io-stages-and-models.md](16-async-nonblocking-io/02-io-stages-and-models.md)
- [16-async-nonblocking-io/03-sync-async-quadrants.md](16-async-nonblocking-io/03-sync-async-quadrants.md)
- [16-async-nonblocking-io/04-linux-multiplexing-evolution.md](16-async-nonblocking-io/04-linux-multiplexing-evolution.md)
- [16-async-nonblocking-io/05-io-uring.md](16-async-nonblocking-io/05-io-uring.md)
- [16-async-nonblocking-io/06-java-nio-channel-buffer-selector.md](16-async-nonblocking-io/06-java-nio-channel-buffer-selector.md)
- [16-async-nonblocking-io/07-direct-buffer-zerocopy.md](16-async-nonblocking-io/07-direct-buffer-zerocopy.md)
- [16-async-nonblocking-io/08-reactor-vs-proactor.md](16-async-nonblocking-io/08-reactor-vs-proactor.md)
- [16-async-nonblocking-io/09-netty-internals.md](16-async-nonblocking-io/09-netty-internals.md)
- [16-async-nonblocking-io/11-backpressure.md](16-async-nonblocking-io/11-backpressure.md)
- [16-async-nonblocking-io/13-virtual-threads-impact.md](16-async-nonblocking-io/13-virtual-threads-impact.md)
- [16-async-nonblocking-io/19-interview-qa.md](16-async-nonblocking-io/19-interview-qa.md)

</details>

<details><summary>#17 Spring Web (12 개)</summary>

- [17-spring-web/00-plan.md](17-spring-web/00-plan.md)
- [17-spring-web/00-preview.md](17-spring-web/00-preview.md)
- [17-spring-web/03-dispatcher-servlet.md](17-spring-web/03-dispatcher-servlet.md)
- [17-spring-web/04-webmvc-vs-webflux.md](17-spring-web/04-webmvc-vs-webflux.md)
- [17-spring-web/05-servlet-filter.md](17-spring-web/05-servlet-filter.md)
- [17-spring-web/07-handler-interceptor.md](17-spring-web/07-handler-interceptor.md)
- [17-spring-web/10-jackson-modules.md](17-spring-web/10-jackson-modules.md)
- [17-spring-web/11-jackson-serializer.md](17-spring-web/11-jackson-serializer.md)
- [17-spring-web/12-jackson-default-typing.md](17-spring-web/12-jackson-default-typing.md)
- [17-spring-web/15-gzip-vary-cache.md](17-spring-web/15-gzip-vary-cache.md)
- [17-spring-web/16-gzip-breach.md](17-spring-web/16-gzip-breach.md)
- [17-spring-web/20-interview-qa.md](17-spring-web/20-interview-qa.md)

</details>

<details><summary>#18 gRPC (18 개)</summary>

- [18-grpc/00-plan.md](18-grpc/00-plan.md)
- [18-grpc/00-preview.md](18-grpc/00-preview.md)
- [18-grpc/01-rpc-vs-rest.md](18-grpc/01-rpc-vs-rest.md)
- [18-grpc/02-protobuf-idl.md](18-grpc/02-protobuf-idl.md)
- [18-grpc/03-proto3-defaults-optional.md](18-grpc/03-proto3-defaults-optional.md)
- [18-grpc/04-grpc-call-patterns.md](18-grpc/04-grpc-call-patterns.md)
- [18-grpc/06-http2-deep-dive.md](18-grpc/06-http2-deep-dive.md)
- [18-grpc/07-protobuf-wire-format.md](18-grpc/07-protobuf-wire-format.md)
- [18-grpc/08-schema-evolution.md](18-grpc/08-schema-evolution.md)
- [18-grpc/09-advanced-features.md](18-grpc/09-advanced-features.md)
- [18-grpc/10-load-balancing.md](18-grpc/10-load-balancing.md)
- [18-grpc/11-error-handling.md](18-grpc/11-error-handling.md)
- [18-grpc/12-auth-mtls-jwt.md](18-grpc/12-auth-mtls-jwt.md)
- [18-grpc/13-interop-gateway-web.md](18-grpc/13-interop-gateway-web.md)
- [18-grpc/14-tradeoffs.md](18-grpc/14-tradeoffs.md)
- [18-grpc/15-msa-hot-paths.md](18-grpc/15-msa-hot-paths.md)
- [18-grpc/16-grpc-vs-kafka.md](18-grpc/16-grpc-vs-kafka.md)
- [18-grpc/20-interview-qa.md](18-grpc/20-interview-qa.md)

</details>

<details><summary>#2 JVM/GC (15 개)</summary>

- [2-jvm-gc/00-preview.md](2-jvm-gc/00-preview.md)
- [2-jvm-gc/01-jvm-memory-areas.md](2-jvm-gc/01-jvm-memory-areas.md)
- [2-jvm-gc/02-object-allocation.md](2-jvm-gc/02-object-allocation.md)
- [2-jvm-gc/03-gc-roots-reachability.md](2-jvm-gc/03-gc-roots-reachability.md)
- [2-jvm-gc/04-gc-algorithms-basics.md](2-jvm-gc/04-gc-algorithms-basics.md)
- [2-jvm-gc/05-gc-overview-stw-throughput.md](2-jvm-gc/05-gc-overview-stw-throughput.md)
- [2-jvm-gc/06-g1gc-deep.md](2-jvm-gc/06-g1gc-deep.md)
- [2-jvm-gc/08-shenandoah.md](2-jvm-gc/08-shenandoah.md)
- [2-jvm-gc/09-gc-log-analysis.md](2-jvm-gc/09-gc-log-analysis.md)
- [2-jvm-gc/10-jit-compilation.md](2-jvm-gc/10-jit-compilation.md)
- [2-jvm-gc/11-nmt-native-memory.md](2-jvm-gc/11-nmt-native-memory.md)
- [2-jvm-gc/12-oom-five-types.md](2-jvm-gc/12-oom-five-types.md)
- [2-jvm-gc/13-heap-dump-mat.md](2-jvm-gc/13-heap-dump-mat.md)
- [2-jvm-gc/16-lab-jfr-jmc.md](2-jvm-gc/16-lab-jfr-jmc.md)
- [2-jvm-gc/22-interview-qa.md](2-jvm-gc/22-interview-qa.md)

</details>

<details><summary>#3 Java/Kotlin Concurrency (14 개)</summary>

- [3-java-kotlin-concurrency/00-plan.md](3-java-kotlin-concurrency/00-plan.md)
- [3-java-kotlin-concurrency/00-preview.md](3-java-kotlin-concurrency/00-preview.md)
- [3-java-kotlin-concurrency/01-thread-lifecycle.md](3-java-kotlin-concurrency/01-thread-lifecycle.md)
- [3-java-kotlin-concurrency/04-atomic-cas.md](3-java-kotlin-concurrency/04-atomic-cas.md)
- [3-java-kotlin-concurrency/05-locks-reentrant-rwlock.md](3-java-kotlin-concurrency/05-locks-reentrant-rwlock.md)
- [3-java-kotlin-concurrency/06-threadlocal.md](3-java-kotlin-concurrency/06-threadlocal.md)
- [3-java-kotlin-concurrency/10-synchronized-internals.md](3-java-kotlin-concurrency/10-synchronized-internals.md)
- [3-java-kotlin-concurrency/11-concurrenthashmap-internals.md](3-java-kotlin-concurrency/11-concurrenthashmap-internals.md)
- [3-java-kotlin-concurrency/12-stampedlock.md](3-java-kotlin-concurrency/12-stampedlock.md)
- [3-java-kotlin-concurrency/13-completablefuture.md](3-java-kotlin-concurrency/13-completablefuture.md)
- [3-java-kotlin-concurrency/18-reactor-vs-coroutine.md](3-java-kotlin-concurrency/18-reactor-vs-coroutine.md)
- [3-java-kotlin-concurrency/19-false-sharing.md](3-java-kotlin-concurrency/19-false-sharing.md)
- [3-java-kotlin-concurrency/20-thread-dump-analysis.md](3-java-kotlin-concurrency/20-thread-dump-analysis.md)
- [3-java-kotlin-concurrency/24-interview-qa.md](3-java-kotlin-concurrency/24-interview-qa.md)

</details>

<details><summary>#4 DB Index/Transaction (18 개)</summary>

- [4-db-index-transaction/00-preview.md](4-db-index-transaction/00-preview.md)
- [4-db-index-transaction/01-why-index.md](4-db-index-transaction/01-why-index.md)
- [4-db-index-transaction/02-btree-bplustree.md](4-db-index-transaction/02-btree-bplustree.md)
- [4-db-index-transaction/04-index-types.md](4-db-index-transaction/04-index-types.md)
- [4-db-index-transaction/05-acid-isolation.md](4-db-index-transaction/05-acid-isolation.md)
- [4-db-index-transaction/06-innodb-page-mvcc.md](4-db-index-transaction/06-innodb-page-mvcc.md)
- [4-db-index-transaction/07-lock-types.md](4-db-index-transaction/07-lock-types.md)
- [4-db-index-transaction/08-deadlock-mdl.md](4-db-index-transaction/08-deadlock-mdl.md)
- [4-db-index-transaction/09-explain.md](4-db-index-transaction/09-explain.md)
- [4-db-index-transaction/10-composite-covering-merge.md](4-db-index-transaction/10-composite-covering-merge.md)
- [4-db-index-transaction/11-anti-patterns.md](4-db-index-transaction/11-anti-patterns.md)
- [4-db-index-transaction/12-statistics-optimizer.md](4-db-index-transaction/12-statistics-optimizer.md)
- [4-db-index-transaction/13-online-ddl.md](4-db-index-transaction/13-online-ddl.md)
- [4-db-index-transaction/14-msa-entities.md](4-db-index-transaction/14-msa-entities.md)
- [4-db-index-transaction/15-msa-queries.md](4-db-index-transaction/15-msa-queries.md)
- [4-db-index-transaction/16-msa-tx-routing.md](4-db-index-transaction/16-msa-tx-routing.md)
- [4-db-index-transaction/17-improvements.md](4-db-index-transaction/17-improvements.md)
- [4-db-index-transaction/18-interview-qa.md](4-db-index-transaction/18-interview-qa.md)

</details>

<details><summary>#5 Spring @Transactional (8 개)</summary>

- [5-spring-transactional/00-preview.md](5-spring-transactional/00-preview.md)
- [5-spring-transactional/04-propagation-7.md](5-spring-transactional/04-propagation-7.md)
- [5-spring-transactional/05-isolation-levels.md](5-spring-transactional/05-isolation-levels.md)
- [5-spring-transactional/09-external-io-separation.md](5-spring-transactional/09-external-io-separation.md)
- [5-spring-transactional/10-transaction-template.md](5-spring-transactional/10-transaction-template.md)
- [5-spring-transactional/12-msa-outbox-saga.md](5-spring-transactional/12-msa-outbox-saga.md)
- [5-spring-transactional/13-improvements.md](5-spring-transactional/13-improvements.md)
- [5-spring-transactional/14-interview-qa.md](5-spring-transactional/14-interview-qa.md)

</details>

<details><summary>#6 Kafka Internals (9 개)</summary>

- [6-kafka-internals/00-preview.md](6-kafka-internals/00-preview.md)
- [6-kafka-internals/02-offset-retention-compaction.md](6-kafka-internals/02-offset-retention-compaction.md)
- [6-kafka-internals/04-producer-tuning.md](6-kafka-internals/04-producer-tuning.md)
- [6-kafka-internals/05-broker-internals.md](6-kafka-internals/05-broker-internals.md)
- [6-kafka-internals/07-consumer-rebalance.md](6-kafka-internals/07-consumer-rebalance.md)
- [6-kafka-internals/08-offset-commit-poll.md](6-kafka-internals/08-offset-commit-poll.md)
- [6-kafka-internals/09-exactly-once.md](6-kafka-internals/09-exactly-once.md)
- [6-kafka-internals/10-idempotency-dlq-failure.md](6-kafka-internals/10-idempotency-dlq-failure.md)
- [6-kafka-internals/12-interview-qa.md](6-kafka-internals/12-interview-qa.md)

</details>

<details><summary>#7 Distributed Systems (13 개)</summary>

- [7-distributed-systems/00-preview.md](7-distributed-systems/00-preview.md)
- [7-distributed-systems/02-cap-pacelc-flp.md](7-distributed-systems/02-cap-pacelc-flp.md)
- [7-distributed-systems/03-consistency-models.md](7-distributed-systems/03-consistency-models.md)
- [7-distributed-systems/04-replica-quorum.md](7-distributed-systems/04-replica-quorum.md)
- [7-distributed-systems/05-clocks-ordering.md](7-distributed-systems/05-clocks-ordering.md)
- [7-distributed-systems/06-paxos-raft.md](7-distributed-systems/06-paxos-raft.md)
- [7-distributed-systems/07-2pc-3pc.md](7-distributed-systems/07-2pc-3pc.md)
- [7-distributed-systems/08-saga-pattern.md](7-distributed-systems/08-saga-pattern.md)
- [7-distributed-systems/10-retry-backoff.md](7-distributed-systems/10-retry-backoff.md)
- [7-distributed-systems/13-distributed-lock.md](7-distributed-systems/13-distributed-lock.md)
- [7-distributed-systems/15-event-sourcing-cqrs.md](7-distributed-systems/15-event-sourcing-cqrs.md)
- [7-distributed-systems/18-codebase-resilience.md](7-distributed-systems/18-codebase-resilience.md)
- [7-distributed-systems/20-interview-qa.md](7-distributed-systems/20-interview-qa.md)

</details>

<details><summary>#8 System Design (13 개)</summary>

- [8-system-design/00-plan.md](8-system-design/00-plan.md)
- [8-system-design/01-design-framework.md](8-system-design/01-design-framework.md)
- [8-system-design/02-url-shortener.md](8-system-design/02-url-shortener.md)
- [8-system-design/03-chat-system.md](8-system-design/03-chat-system.md)
- [8-system-design/04-feed-system.md](8-system-design/04-feed-system.md)
- [8-system-design/05-payment-system.md](8-system-design/05-payment-system.md)
- [8-system-design/07-notification-system.md](8-system-design/07-notification-system.md)
- [8-system-design/08-ticketing-system.md](8-system-design/08-ticketing-system.md)
- [8-system-design/09-search-system.md](8-system-design/09-search-system.md)
- [8-system-design/10-ecommerce-system.md](8-system-design/10-ecommerce-system.md)
- [8-system-design/11-map-system.md](8-system-design/11-map-system.md)
- [8-system-design/12-improvements.md](8-system-design/12-improvements.md)
- [8-system-design/13-interview-qa.md](8-system-design/13-interview-qa.md)

</details>

<details><summary>#9 Redis Deep Dive (13 개)</summary>

- [9-redis-deep-dive/00-plan.md](9-redis-deep-dive/00-plan.md)
- [9-redis-deep-dive/01-single-thread-and-io.md](9-redis-deep-dive/01-single-thread-and-io.md)
- [9-redis-deep-dive/02-data-structures-overview.md](9-redis-deep-dive/02-data-structures-overview.md)
- [9-redis-deep-dive/03-internal-encodings-1.md](9-redis-deep-dive/03-internal-encodings-1.md)
- [9-redis-deep-dive/04-internal-encodings-2.md](9-redis-deep-dive/04-internal-encodings-2.md)
- [9-redis-deep-dive/08-replication-sentinel.md](9-redis-deep-dive/08-replication-sentinel.md)
- [9-redis-deep-dive/10-cache-patterns.md](9-redis-deep-dive/10-cache-patterns.md)
- [9-redis-deep-dive/11-cache-stampede.md](9-redis-deep-dive/11-cache-stampede.md)
- [9-redis-deep-dive/12-distributed-lock-setnx.md](9-redis-deep-dive/12-distributed-lock-setnx.md)
- [9-redis-deep-dive/13-distributed-lock-redlock.md](9-redis-deep-dive/13-distributed-lock-redlock.md)
- [9-redis-deep-dive/14-stream-consumer-group.md](9-redis-deep-dive/14-stream-consumer-group.md)
- [9-redis-deep-dive/15-pipeline-lua-pubsub.md](9-redis-deep-dive/15-pipeline-lua-pubsub.md)
- [9-redis-deep-dive/19-interview-qa.md](9-redis-deep-dive/19-interview-qa.md)

</details>

<details><summary>루트 (00-INDEX 등) (2 개)</summary>

- [00-CODE-INDEX.md](00-CODE-INDEX.md)
- [00-INTERVIEW-INDEX.md](00-INTERVIEW-INDEX.md)

</details>

