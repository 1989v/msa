---
parent: 10-observability
phase: 3
title: msa 코드베이스 현 상태 + Gap 분석
created: 2026-05-01
---

# 12. msa 코드베이스 — Observability 현 상태 grep 결과

> 본 문서는 grep / Read 로 확인한 **사실** 만 기재. 추정은 분리 표기.

## 1. Metrics — Prometheus 인프라 (도입 완료)

### 1.1 ServiceMonitor (실제 파일 인용)

`k8s/infra/prod/monitoring/servicemonitor-apps.yaml`:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: commerce-platform-apps
  namespace: monitoring
  labels:
    release: kube-prometheus-stack
spec:
  namespaceSelector:
    matchNames:
      - commerce
  selector:
    matchLabels:
      app.kubernetes.io/part-of: commerce-platform
  endpoints:
    - port: http
      path: /actuator/prometheus
      interval: 30s
      scrapeTimeout: 10s
```

→ `part-of: commerce-platform` 라벨 자동 발견. 서비스 추가 시 zero-config.

### 1.2 kube-prometheus-stack 설정

`k8s/infra/prod/monitoring/values.yaml`:

```yaml
prometheus:
  prometheusSpec:
    retention: 15d
    serviceMonitorSelectorNilUsesHelmValues: false
    podMonitorSelectorNilUsesHelmValues: false
    ruleSelectorNilUsesHelmValues: false   # ← PrometheusRule 자유 등록 가능
grafana:
  sidecar:
    dashboards:
      enabled: true
      label: grafana_dashboard
      labelValue: "1"
    datasources:
      enabled: true
      label: grafana_datasource
nodeExporter:
  enabled: true
kubeStateMetrics:
  enabled: true
```

→ retention 15d, exemplar storage 미활성, recording/alerting rule 미작성.

### 1.3 Micrometer 의존 — 16개 서비스 모두

```bash
grep -rn "micrometer-registry-prometheus" --include="*.gradle.kts"
```

확인된 서비스 (16개):
- order, gifticon, auth, chatbot, member, fulfillment, product, search,
  inventory, experiment, code-dictionary, quant, warehouse, gateway,
  wishlist, analytics

→ **모든 서비스 Micrometer 도입 완료**.

### 1.4 application.yml 표준

`product/app/src/main/resources/application.yml:54-77` 전형:

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,prometheus
  endpoint:
    health:
      show-details: always
      probes:
        enabled: true
      group:
        liveness:
          include: livenessState
        readiness:
          include: readinessState
  health:
    livenessstate:
      enabled: true
    readinessstate:
      enabled: true
  metrics:
    tags:
      application: ${spring.application.name}
```

확인된 서비스 (grep `include: health,info,metrics,prometheus`):
order, gifticon, auth, chatbot, member, fulfillment, product, search, inventory

→ 일부 서비스 (analytics, gateway, quant, wishlist 등) 의 application.yml 직접 검증 누락 — **Phase 3 자체 검증 필요**.

### 1.5 ADR-0025 준수 누락 사항

ADR-0025 §4 가 명시한 것 중 미적용:

| 요구 | 현재 | 격차 |
|---|---|---|
| `percentiles-histogram=true` | application.yml 에 없음 | 모든 서비스 추가 필요 |
| `slo` bucket | 없음 | 추가 필요 |
| Heatmap 패널 | dashboard 에 없음 | http-dashboard 추가 |
| RED Errors panel | 없음 | http-dashboard 추가 |

## 2. Grafana Dashboard

### 2.1 존재하는 dashboard 3종 (실제 파일)

```
k8s/infra/prod/monitoring/dashboards/
├── http-dashboard.json
├── jvm-dashboard.json
├── service-overview.json
└── kustomization.yaml
```

### 2.2 http-dashboard.json 분석 (실제)

확인된 panel 2개:
1. **Request Rate** — `sum(rate(http_server_requests_seconds_count{application=~"$application"}[1m])) by (application)`
2. **Response Time (p50/p95/p99)** — `histogram_quantile(0.{50,95,99}, sum(rate(http_server_requests_seconds_bucket{application=~"$application"}[1m])) by (le, application))`

→ RED 의 R / D 만 — **E (Error Ratio) 누락**.

→ application variable, datasource variable 적용됨.

### 2.3 jvm-dashboard.json 분석

확인된 panel:
1. JVM Heap Memory (used + max)
2. JVM Non-Heap Memory
3. (이하 GC, threads 등 — 직접 검증 누락)

→ #02 의 JFR cross-ref. GC pause heatmap 추가 권장.

### 2.4 누락된 dashboard

- **HikariCP / DB Pool** dashboard
- **Kafka Consumer Lag** dashboard
- **SLO Burn Rate** dashboard
- **Latency Heatmap** (ADR-0025 강제 항목)
- **Trace 통합** (Tempo 도입 후)

## 3. Logs — 거의 비어 있음

### 3.1 grep 결과 — 미도입 증거

```bash
find /Users/gideok-kwon/IdeaProjects/msa -type f -name "logback*.xml"
# (결과 없음)
```

→ **logback-spring.xml 0개**. 모든 서비스가 Spring Boot 기본 logger (text 출력).

```bash
grep -rn "MDC\|trace_id\|traceparent" common gateway product --include="*.kt"
# (결과 없음)
```

→ **MDC / trace ID 전파 코드 0개**. 분산 trace 의 기반 자체가 없음.

```bash
grep -rn "logstash\|loki" --include="*.gradle.kts"
# (결과 없음)
```

→ **로그 수집 도구 미도입**.

### 3.2 logging convention 은 있음

`docs/conventions/logging.md` 가 룰 정의:
- kotlin-logging 표준
- 람다 형식 강제
- PII 금지
- error 레벨 규칙

→ **룰은 있으나 인프라 없음**. 코드 컨벤션은 의식되어 있으나 수집 / 검색 / 알람 / drill-down 미구현.

### 3.3 audit_log 패턴 (quant)

`QuantMetrics.kt:167-185` 실제 인용:

```kotlin
private val auditLogAppendedCounter: Counter = Counter
    .builder(METRIC_AUDIT_LOG_APPENDED_TOTAL)
    .description("Total audit_log rows successfully appended (writer user, ClickHouse quant_audit)")
    .register(registry)

private val auditHashChainInvalidCounter: Counter = Counter
    .builder(METRIC_AUDIT_HASH_CHAIN_INVALID_TOTAL)
    .description("Total invalid hash-chain rows detected by AuditChainVerifier")
    .register(registry)
```

→ ClickHouse `quant_audit` 가 컴플라이언스 로그 저장 — 일반 application log 와 분리된 정답 패턴.

## 4. Traces — 완전 비어 있음

### 4.1 grep 결과

```bash
grep -rn "opentelemetry\|otel\|sleuth\|brave\|jaeger\|zipkin\|tempo" \
  --include="*.gradle.kts" --include="*.kt"
# (결과 없음, quant 도 마찬가지)
```

→ OpenTelemetry / Sleuth / Brave / Tempo 미도입. **Trace 인프라 0**.

### 4.2 ADR / Spec 에 언급은 있음

`docs/specs/2026-04-09-monitoring-infrastructure-design.md` 인용:
> 2차 (주석 준비): Logstash / Kibana / Zipkin (docker-compose 주석)

→ Spec 단계에서 의도는 있었으나 ADR-0019 (K8s 마이그레이션) 후 docker-compose 가 제거되며 Tracing 도 미도입 상태.

## 5. Micrometer 활용 사례 — quant 가 모범

### 5.1 QuantMetrics.kt — 실제 메트릭 정의

위치: `quant/app/src/main/kotlin/com/kgd/quant/infrastructure/metrics/QuantMetrics.kt`

확인된 메트릭 (실제 코드 발췌):

```kotlin
const val METRIC_BACKTEST_RUN_TOTAL = "quant_backtest_run_total"
const val METRIC_BACKTEST_RUN_DURATION = "quant_backtest_run_duration_seconds"
const val METRIC_STRATEGY_EVALUATION_LATENCY = "quant_strategy_evaluation_latency_seconds"
const val METRIC_INGEST_BITHUMB_ROWS_TOTAL = "quant_ingest_bithumb_rows_total"
const val METRIC_OUTBOX_PENDING_ROWS = "quant_outbox_pending_rows"
const val METRIC_KEK_CACHE_HITS_TOTAL = "quant_kek_cache_hits_total"
const val METRIC_KEK_CACHE_MISSES_TOTAL = "quant_kek_cache_misses_total"
const val METRIC_KEK_CACHE_STALE_TOTAL = "quant_kek_cache_stale_total"
const val METRIC_KEK_ROTATION_LAZY_REENCRYPT_TOTAL = "quant_kek_rotation_lazy_reencrypt_total"
const val METRIC_AUDIT_LOG_APPENDED_TOTAL = "quant_audit_log_appended_total"
const val METRIC_AUDIT_HASH_CHAIN_INVALID_TOTAL = "quant_audit_hash_chain_invalid_total"
const val METRIC_MARKET_TICK_RECEIVED_TOTAL = "quant_market_tick_received_total"
const val METRIC_WS_RECONNECT_ATTEMPTS_TOTAL = "quant_ws_reconnect_attempts_total"
const val METRIC_WS_CONNECTION_STATE = "quant_ws_connection_state"
const val METRIC_MARKET_HUB_DROPPED_TOTAL = "quant_market_hub_dropped_total"
const val METRIC_MARKET_HUB_KAFKA_PUBLISH_FAILURE_TOTAL = "quant_market_hub_kafka_publish_failure_total"
const val METRIC_NOTIFICATION_SEND_LATENCY = "quant_notification_send_latency_seconds"
const val METRIC_NOTIFICATION_SEND_FAILURE_TOTAL = "quant_notification_send_failure_total"
const val METRIC_NOTIFICATION_QUEUE_DEPTH = "quant_notification_queue_depth"
const val METRIC_OUTBOX_PUBLISH_TOTAL = "quant_outbox_publish_total"
const val METRIC_OUTBOX_PUBLISH_FAILURE_TOTAL = "quant_outbox_publish_failure_total"
```

총 21개 비즈니스 메트릭 — Counter / Timer / Gauge 모두 활용.

### 5.2 카디널리티 룰 — 코드 주석으로 강제 (실제 인용)

```
## 사용 규칙 (ADR-0021)
- API key / Bot token / 평문 credential 을 태그 값으로 절대 사용하지 않는다.
- symbol 태그는 거래쌍(BTC_KRW 등) 과 같이 카디널리티가 제한된 값만 허용.
- from_version / to_version 태그는 KEK 라벨이 아닌 INT 값 — 카디널리티 제한.
- exchange, outcome, source, reason 태그 또한 enum 또는 상수 집합으로만 발행.
- channel, priority, reason (notification) 태그도 enum / 상수 집합만 사용.
- topic (outbox) 태그는 Kafka 토픽 이름 — Phase 2 generic quant.events.v1 단일 (카디널리티 1).
```

→ **#03 의 카디널리티 룰을 코드 주석으로 거버넌스**. 다른 서비스도 이 패턴 따르도록 표준화 권장 (#13).

### 5.3 OutboxPendingMetric — Gauge 의 정석

`quant/.../OutboxPendingMetric.kt:36-54` (실제 인용):

```kotlin
@PostConstruct
fun register() {
    Gauge.builder(QuantMetrics.METRIC_OUTBOX_PENDING_ROWS, this) { it.currentPending() }
        .description("Outbox rows with published_at IS NULL")
        .register(registry)
}

private fun currentPending(): Double {
    runCatching { outboxRepository.countByPublishedAtIsNull() }
        .onSuccess { pending.set(it) }
        .onFailure { e ->
            logger.debug { "OutboxPendingMetric count query failed: ${e.message}" }
        }
    return pending.get().toDouble()
}
```

→ scrape 시점 lazy 계산 + 실패 시 마지막 값 유지. #03 의 Gauge 패턴 정석.

## 6. ADR-0025 (Latency Budget) — 측정 표준 명시

`docs/adr/ADR-0025-latency-budget.md` 의 "Decision §4" (실제 인용):

```
모든 JVM 서비스는:
- Spring Boot Actuator + Micrometer 로 http_server_requests_seconds_* 메트릭 노출
- percentiles-histogram: true + bucket SLO 설정
- Prometheus + Grafana 의 RED + Heatmap 패널 필수
```

§5 PR 체크리스트:
- 속한 Tier
- 예상 자릿수 (ns / µs / ms / 100ms+)
- fan-out / 외부 호출 / 캐시 적용 여부
- 측정 방법

→ ADR 은 강제하지만 **application.yml 에 percentiles-histogram 미설정**. 적용 ADR 후속 필요.

## 7. 종합 Gap 매트릭스

| 영역 | 인프라 | App 코드 | 컨벤션 | Dashboard | Alert | SLO |
|---|---|---|---|---|---|---|
| Metrics (Prometheus) | ✅ kube-prom | ✅ Micrometer 16개 | ✅ ADR-0025 | △ 일부 | ❌ Rule 0개 | ❌ |
| Metrics (Cardinality) | n/a | △ 일부 | ✅ ADR-0021 | n/a | n/a | n/a |
| Logs (Loki/ELK) | ❌ | ❌ logback xml | ✅ logging.md | ❌ | ❌ | ❌ |
| Logs (MDC trace) | ❌ | ❌ Filter 없음 | ❌ | ❌ | ❌ | ❌ |
| Traces (OTel) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| SLO (Sloth) | ❌ | n/a | △ ADR-0025 | ❌ | ❌ | △ |
| Profiling (Pyroscope) | ❌ | ❌ | ❌ | ❌ | n/a | n/a |
| Exemplar (M↔T) | ❌ (Prom feature 미활성) | ❌ | n/a | ❌ | n/a | n/a |
| Alertmanager Receiver | △ 기본만 | n/a | ❌ | n/a | ❌ | n/a |

→ **격차 큰 순서**: Logs > Traces > SLO > Profiling > Alert Rule > Exemplar > Cardinality 검증.

## 8. 우선순위 결정 — ROI 매트릭스

```
              비용/노력 ↓
              │
         A    │    B
              │
Loki+MDC ────┼──── OpenTelemetry
              │
              │
              │
         C    │    D
              │
SLO Sloth ───┼──── Pyroscope
              │
              ───────────────→  운영 가치 ↑
```

- **A (Loki+MDC)**: 작업량 1-2주, 가치 ⭐⭐⭐⭐⭐ (drill-down 의 진입점)
- **B (OpenTelemetry)**: 1-2주, ⭐⭐⭐⭐⭐ (분산 trace + Exemplar)
- **C (SLO)**: 1주, ⭐⭐⭐⭐
- **D (Pyroscope)**: 1주, ⭐⭐⭐ (4번째 pillar)

→ 순서: **A → B → C → D** (#13 ADR 우선순위에 반영).

## 9. 즉시 시작 가능한 작은 PR 5개

ADR 작성 전 즉시 가능한 quick win:

1. **`percentiles-histogram=true` 일괄 추가** (16개 application.yml) — ADR-0025 §4 반영
2. **http-dashboard.json 에 Errors Ratio panel 추가** — RED 의 E
3. **http-dashboard.json 에 Latency Heatmap panel 추가** — ADR-0025 §4
4. **PrometheusRule CR 작성** — Tier 1 P99 alert (ADR-0025 §3 강제)
5. **kustomization.yaml 에 jvm-dashboard / http-dashboard 외 hikari panel 분리**

## 10. 핵심 정리 (Phase 3 발견)

- Metrics 인프라 **튼튼함** — kube-prometheus-stack + ServiceMonitor + Micrometer 16개
- Dashboard 3종 있음 — RED 의 Errors / Heatmap 누락
- **로그 인프라 0** — logback-spring.xml, MDC, Loki/ELK 모두 없음
- **Trace 인프라 0** — OpenTelemetry / Tempo / Jaeger 모두 없음
- **SLO / Burn Rate alert 0** — ADR-0025 가 측정 표준만 정의, 알람 ADR 별도 필요
- quant 의 QuantMetrics.kt 가 카디널리티 룰의 모범 — 다른 서비스 표준화 권장
- 우선순위: **Loki+MDC → OpenTelemetry → SLO → Pyroscope**

## 11. 다음 단계

- [13-improvements.md](13-improvements.md) — ADR 초안 (Loki / OpenTelemetry / RED 표준화 / SLO)
- [14-interview-qa.md](14-interview-qa.md) — 면접 Q&A 카드
