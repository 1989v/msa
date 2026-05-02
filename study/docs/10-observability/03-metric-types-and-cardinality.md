---
parent: 10-observability
phase: 2
title: 메트릭 타입 4종 + Histogram vs Summary + Cardinality 설계
created: 2026-05-01
---

# 03. Metric Types — Counter/Gauge/Histogram/Summary 와 Cardinality 설계

## 1. Counter — 단조 증가

**의미**: 결코 감소하지 않는 누적값. 재시작 시 0으로 reset (Prometheus 가 reset 감지).

```kotlin
// 실제 코드: quant/.../QuantMetrics.kt:68-77
val backtestRunSuccess: Counter = Counter.builder(METRIC_BACKTEST_RUN_TOTAL)
    .description("Total successful backtest runs")
    .tag("status", "success")
    .register(registry)

val backtestRunFailed: Counter = Counter.builder(METRIC_BACKTEST_RUN_TOTAL)
    .description("Total failed backtest runs")
    .tag("status", "failed")
    .register(registry)

// 사용처: backtestRunSuccess.increment()
```

### 1.1 절대값이 아니라 rate 로 본다

```promql
# ❌ 의미 없음 — 인스턴스 시작 후 누적값
backtest_run_total{status="success"}

# ✅ 5분 이동 평균 — 초당 성공 횟수
rate(backtest_run_total{status="success"}[5m])

# ✅ 즉시 변화율 — 2개 sample 만으로
irate(backtest_run_total{status="success"}[2m])
```

- `rate(x[5m])` = `(x_now - x_5m_ago) / 300s` (counter reset 자동 보정)
- `irate` = 마지막 2 sample → 빠른 변화 (alert 용도)
- `increase(x[5m])` = `x_now - x_5m_ago` (rate × duration)

### 1.2 Counter 함정: bucket 함수 안에서는 `_count` 가 Counter

Histogram 의 `<name>_count` 는 사실 Counter — `rate()` 를 씌워야 함.

```promql
# ❌ count 자체는 누적값
http_server_requests_seconds_count

# ✅
sum(rate(http_server_requests_seconds_count[1m])) by (application)
```

→ 실제 msa 의 `http-dashboard.json:30` 이 이 패턴:
```promql
sum(rate(http_server_requests_seconds_count{application=~"$application"}[1m])) by (application)
```

## 2. Gauge — 즉시 값

**의미**: 임의 시점의 상태. 증가/감소 자유.

```kotlin
// 실제 코드: quant/.../OutboxPendingMetric.kt:36-41
@PostConstruct
fun register() {
    Gauge.builder(QuantMetrics.METRIC_OUTBOX_PENDING_ROWS, this) { it.currentPending() }
        .description("Outbox rows with published_at IS NULL")
        .register(registry)
}
```

→ Gauge 의 함수는 **scrape 시점에 호출** 됨. `currentPending()` 이 DB count 쿼리를 매번 실행 → 코드 주석에 "스크레이프 직전 업데이트" 명시.

### 2.1 Gauge 패턴 3가지

| 패턴 | 예 | 코드 위치 |
|---|---|---|
| Atomic 값 노출 | `wsConnectionStates: AtomicInteger` | QuantMetrics.kt:239-255 |
| **Lazy 계산** (scrape 시) | DB count, queue size | OutboxPendingMetric.kt |
| collection size | Notification queue depth | QuantMetrics.kt:344-353 |

### 2.2 Gauge 의 함정 — scrape interval 동안의 값은 모름

Gauge 는 **point-in-time snapshot** 만 보낸다. scrape 사이의 변동은 보이지 않음.

```
실제 queue size 변동:  5, 50, 5, 5, 50, 5  (1초 단위)
30초 scrape 결과:       5    (마지막 값만)
```

→ 스파이크 탐지가 필요하면 **Histogram** 으로 sampled max 추적.

## 3. Histogram — bucket 분포

**의미**: 관측값을 미리 정의된 bucket (`le=`) 에 누적. P50/P95/P99 산출 가능.

### 3.1 Spring Boot 자동 노출 — `http_server_requests_seconds`

```
http_server_requests_seconds_bucket{le="0.005"}  ← 누적 (≤5ms)
http_server_requests_seconds_bucket{le="0.01"}   ← 누적 (≤10ms)
...
http_server_requests_seconds_bucket{le="+Inf"}   ← 전체
http_server_requests_seconds_count               ← 합계 = +Inf bucket
http_server_requests_seconds_sum                 ← duration 합
```

### 3.2 PromQL `histogram_quantile`

```promql
histogram_quantile(0.99,
  sum(rate(http_server_requests_seconds_bucket{application="product"}[1m]))
    by (le)
)
```

**중요**: `sum(by (le))` 가 필수 — bucket 별로 모아야 quantile 보간 가능.

### 3.3 Histogram 의 "cluster aggregation" 강점

Pod A: bucket{le="0.05"}=100
Pod B: bucket{le="0.05"}=200
→ `sum(...) by (le)` 후 `histogram_quantile` → **클러스터 전체 P99** 산출 가능.

→ 분산 환경에서는 **Histogram 이 사실상 유일한 답**. (Summary 는 인스턴스 별 quantile 만 있어 합산 불가)

## 4. Summary — client-side quantile

**의미**: 클라이언트가 직접 quantile 계산해서 노출.

```
http_server_requests_seconds{quantile="0.5"}  0.012
http_server_requests_seconds{quantile="0.95"} 0.080
http_server_requests_seconds{quantile="0.99"} 0.250
http_server_requests_seconds_count            10000
http_server_requests_seconds_sum              25.4
```

### 4.1 장단점

| 항목 | Summary | Histogram |
|---|---|---|
| 정확도 (단일 인스턴스) | ✅ 클라이언트 계산 (정확) | ❌ bucket 보간 (오차) |
| Cluster aggregation | ❌ 불가능 (sum of quantile != quantile of sum) | ✅ `sum(by (le))` 가능 |
| Bucket 사전 정의 | 불필요 | 필요 |
| 비용 | 클라이언트 메모리 큼 (sliding window) | bucket 개수 만큼 |
| 동적 quantile 변경 | ❌ 불가 (런타임 quantile 변경 어려움) | ✅ PromQL 로 자유 |

### 4.2 결론 — 거의 항상 Histogram

> **Spring Boot 권장**: `percentiles-histogram=true` (Histogram). `percentiles=0.5,0.95,0.99` 만 쓰면 Summary 에 가까운 client-side calc — 단일 인스턴스 한정.

→ ADR-0025 §4 도 "percentiles-histogram=true" 명시. Summary 만으로는 다중 Pod 환경에서 cluster P99 를 못 구한다.

## 5. Histogram bucket 설계

### 5.1 잘못된 bucket — 정보 손실

```
le="1s", "10s", "100s"  →  P99 가 5s 인데 bucket 이 1s 와 10s 사이에 있음
                          → histogram_quantile 보간이 1-10s 사이에서만 가능 → 큰 오차
```

### 5.2 SLO 인근에 dense bucket

```yaml
# Tier 1 (P99 100ms 목표) 의 좋은 bucket
slo: 50ms, 100ms, 200ms, 500ms, 1s, 2s
percentiles-histogram: true
```

Spring Boot 는 위 SLO + 기본 bucket 을 합쳐 약 30개 bucket 자동 생성. msa 의 ADR-0025 권장.

### 5.3 Native Histogram (Prometheus 2.40+)

- 기존: 사전 정의 bucket (~30 시계열)
- Native: sparse exponential bucket → **시계열 1개** + 가변 bucket
- 비용 ~10x 절감 + 정확도 향상
- 2026 기준 GA. msa 의 차기 ADR 후보.

## 6. Counter / Gauge / Histogram 의 cardinality 비용

각 시계열의 비용:
```
1 timeseries × ~3KB head + ~150 bytes/sample × 24시간/15s scrape ~= 6MB / day / series
```

| 메트릭 | bucket 수 | 라벨 (조심해야 할 것) | 카디널리티 |
|---|---|---|---|
| Counter `cart_item_added_total{user_id, product_id}` | 1 | userId × productId = 100k × 10k = 10^9 | **위험** (Prometheus 폭발) |
| Histogram `http_server_requests_seconds{path, method, status}` | ~30 | path × method × status = 200 × 5 × 30 = 30k → 30k × 30 buckets = **900k** | 위험 (단일 서비스에서) |
| Histogram `http_server_requests_seconds{uri_template, method, status}` | ~30 | template × method × status = 50 × 5 × 30 = 7.5k → 225k | 안전한 편 |

### 6.1 라벨 설계 룰 5가지

1. **enum 또는 finite 집합만** — `method`, `status code` (2xx/4xx/5xx), `outcome`
2. **template path** — `/users/{id}` not `/users/12345`
3. **request 별 식별자 금지** — `userId`, `traceId`, `requestId`
4. **bounded 가 아닌 라벨은 메트릭 자체로 분리** — productId 별 카운트가 필요하면 그 자체를 별 메트릭 (별로 만들지 말 것)
5. **제거 가능한 차원은 제거** — host/instance 는 instance 라벨로 자동, 직접 추가 금지

### 6.2 msa 의 적용 사례 (실제)

`QuantMetrics.kt` 의 룰 (실제 코드 인용 54-60):
```
- API key / Bot token / 평문 credential 을 태그 값으로 절대 사용하지 않는다.
- symbol 태그는 거래쌍(BTC_KRW 등) 과 같이 카디널리티가 제한된 값만 허용.
- from_version / to_version 태그는 KEK 라벨이 아닌 INT 값 — 카디널리티 제한.
- exchange, outcome, source, reason 태그 또한 enum 또는 상수 집합으로만 발행.
```

- `topic` 라벨에 대해서도: "Phase 2 generic `quant.events.v1` 단일 (카디널리티 1)" — Kafka 토픽 이름은 finite 라 안전하지만 명시적으로 카디널리티 1 임을 검증.

→ 면접 답변 모범: "라벨 설계는 enum/상수만 허용하고 코드 리뷰 시 카디널리티 추정값을 댓글로 남깁니다. msa 의 QuantMetrics 가 모범 사례 — 모든 라벨에 카디널리티 상한을 docstring 에 명시했습니다."

## 7. Counter 캐싱 패턴 — Micrometer 비용

`Counter.builder(...).register(registry)` 는 비용 있음 (registry 내부 lookup + GC). 매 호출 시 build 하면 안 됨.

```kotlin
// 실제 코드: QuantMetrics.kt:93, 102-110
private val ingestCounters = ConcurrentHashMap<String, Counter>()

fun ingestRowsIncrement(symbol: String, rows: Long) {
    if (rows <= 0L) return
    val counter = ingestCounters.computeIfAbsent(symbol) {
        Counter.builder(METRIC_INGEST_BITHUMB_ROWS_TOTAL)
            .tag("symbol", symbol)
            .register(registry)
    }
    counter.increment()
}
```

→ symbol 당 1번만 build, 이후 increment 만. **정석 패턴**.

### 7.1 Tag 가 동적으로 추가될 위험

```kotlin
// ❌ 위험 — userId 가 라벨이 됨, 카디널리티 폭발
fun trackUser(userId: String) {
    Counter.builder("user_action_total")
        .tag("user_id", userId)
        .register(registry).increment()
}
```

→ 코드 리뷰 차단 항목. 카디널리티 라벨이 동적이면 무조건 enum/상수 로 변환.

## 8. Timer — Histogram + Counter + Total time 합집합

Micrometer 의 Timer 는 사실상 Histogram + sum + count.

```kotlin
// 실제: QuantMetrics.kt:80-90
val backtestDuration: Timer = Timer.builder(METRIC_BACKTEST_RUN_DURATION)
    .description("Backtest run duration in seconds")
    .publishPercentiles(0.5, 0.95, 0.99)
    .register(registry)

// 사용
fun recordBacktestDuration(nanos: Long) {
    backtestDuration.record(nanos, TimeUnit.NANOSECONDS)
}
```

노출되는 메트릭:
```
quant_backtest_run_duration_seconds_count       (Counter)
quant_backtest_run_duration_seconds_sum         (Counter)
quant_backtest_run_duration_seconds_max         (Gauge)
quant_backtest_run_duration_seconds{quantile="0.5"}   (client-side)
quant_backtest_run_duration_seconds_bucket{le="..."}  (Histogram, percentiles-histogram=true 시)
```

> **Timer 가 latency 측정의 정답** — `System.nanoTime()` 으로 수동 측정 + Counter 조합은 안티패턴.

## 9. JVM / Tomcat / Hikari 자동 binder

Spring Boot 가 자동으로 binder 등록 — 별도 코드 없음.

| Binder | 메트릭 |
|---|---|
| `JvmMemoryMetrics` | `jvm_memory_*` (heap/nonheap/buffer) |
| `JvmGcMetrics` | `jvm_gc_*` (#02 cross-ref) |
| `JvmThreadMetrics` | `jvm_threads_states_threads` |
| `ProcessorMetrics` | `system_cpu_usage`, `process_cpu_usage` |
| `TomcatMetrics` | `tomcat_threads_busy_threads` |
| `HikariCPMetrics` | `hikaricp_connections_*` (#15 cross-ref Saturation) |
| `KafkaConsumerMetrics` | `kafka_consumer_records_consumed_total` |
| `LogbackMetricsBinder` | `logback_events_total{level=...}` |

→ **별도 코드 없이 jvm-dashboard 와 hikari panel 이 동작하는 이유**. msa 의 `jvm-dashboard.json` 도 이 메트릭들로 구성.

## 10. 핵심 정리

- 4 타입: **Counter (단조)**, **Gauge (즉시)**, **Histogram (분포 + cluster aggregation)**, **Summary (client quantile, 합산 불가)**
- 면접 정답: **Histogram > Summary** — `sum(by (le))` 후 `histogram_quantile`
- Cardinality 룰: enum/상수만, raw ID 금지, template path 만
- Counter 는 ConcurrentHashMap 캐싱 — 매번 build 금지
- Spring Boot 자동 binder 가 RED + USE + JVM dashboard 의 90% 를 무료 제공
- msa 의 QuantMetrics.kt 가 카디널리티 룰의 모범 사례

## 11. 다음 단계

- [04-promql-and-alerting.md](04-promql-and-alerting.md) — PromQL 함수 / Recording Rules / Alertmanager
