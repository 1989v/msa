# ADR-0028 분산 추적 표준 — OpenTelemetry + Tempo 도입

## Status

Accepted (2026-05-02)

**Date**: 2026-05-02
**Authors**: TBD
**Related**: ADR-0015 (Resilience Strategy), ADR-0019 (K8s Migration), ADR-0021 (Logging Conventions, conventions/logging.md 으로 이전), ADR-0025 (Latency Budget), ADR-0026 (docs taxonomy)
**Supersedes / Extends**: 없음 (신규 cross-cutting 결정)

## Context

본 ADR 은 18개 학습 주제 deep study 산출물 (`study/docs/{2..18}/*-improvements.md`) 의 ADR 후보 통합 결과 (`study/docs/00-ADR-CANDIDATES.md`) 에서 **가장 많이 cross-reference 된 후보** 다. 6개 주제가 동시에 동일 결정을 요청했다.

| 주제 | 인용 위치 | 요청 |
|---|---|---|
| #6 Kafka | `study/docs/6-kafka/*-improvements.md` | Saga choreography 의 trace_id 전파 |
| #7 분산시스템 | `study/docs/7-distributed/*-improvements.md` | Saga / 2PC / idempotency 추적 가시성 |
| #8 System Design | `study/docs/8-system-design/2-3-saga.md` | 시나리오별 분산 trace 표준 |
| #10 Observability | `study/docs/10-observability/13-improvements.md` | OTel + Tempo + Exemplar (ADR-X3) |
| #11 K8s | `study/docs/11-k8s/*-improvements.md` | 다중 Pod 횡단 trace |
| #17 Spring Web | `study/docs/17-spring-web/*-improvements.md` | TraceIdFilter / WebClient 자동 헤더 |

### 1. msa 코드베이스 현 상태 — Trace/MDC 인프라 0

`study/docs/10-observability/12-msa-current-state.md` 의 grep 결과 (인용):

```bash
find . -type f -name "logback*.xml"
# (결과 없음)

grep -rn "MDC\|trace_id\|traceparent" common gateway product --include="*.kt"
# (결과 없음)

grep -rn "opentelemetry\|otel\|sleuth\|brave\|jaeger\|zipkin\|tempo" \
  --include="*.gradle.kts" --include="*.kt"
# (결과 없음)
```

즉:

- `logback-spring.xml` 0개 — 모든 서비스가 Spring Boot 기본 plain text 로 stdout 출력
- MDC / trace_id 전파 코드 0개
- OpenTelemetry / Sleuth / Brave / Tempo / Jaeger 의존성 0개

### 2. 현재 구조의 문제

#### 2.1 Choreography Saga 의 가시성 0

`order` → Kafka `order.created` → `inventory` → Kafka `inventory.reserved` → `payment` → Kafka `payment.completed` → `order` (상태 전이) 의 흐름이 **한 곳에서 보이지 않음**. 한 주문이 어디까지 갔는지 trace 가 없으면 운영 디버깅 30분 이상.

#### 2.2 ADR-0025 의 Tier 1 P99 SLA 검증 불가

ADR-0025 §3 은 Tier 1 (사용자 직접 응답 경로) 에 대해 P99 alerting 강제. 그러나 alert 발화 시 **어느 hop 이 P99 인지 분해 불가** — gateway / product / inventory / mysql / kafka 중 어디인가? Trace 없이는 fan-out tail 분석 불가능.

#### 2.3 외부 호출 (`WebClient`) trace 끊김

`order` 서비스가 `product` 호출 시 (`order/app/.../WebClientConfig.kt` 의 `${product.service.url}` 주입 패턴) trace context 가 헤더로 전파되지 않음. downstream 의 span 이 root 가 되어 분산 trace 가 끊어짐.

#### 2.4 비동기 경계 (Kafka) 의 trace 단절

Producer → Consumer 간 Kafka header 에 `traceparent` 없음. Consumer 가 항상 새 root span 생성 → "이 메시지가 어떤 요청에서 발행됐는가" 추적 불가.

#### 2.5 Coroutine / Webflux 환경의 context 전파 미설계

- `gateway` (Webflux Reactor Netty) — `Reactor Context` 전파 패턴 부재
- `quant` (Kotlin Coroutine 기반, ADR-0024) — `MDCContext` 가이드 부재

#### 2.6 로그-trace correlation 0

`docs/conventions/logging.md` 가 kotlin-logging 룰만 정의하고 trace_id MDC 필드는 정의하지 않음. 로그 검색 시 trace_id 로 join 불가능.

### 3. 왜 지금인가

- `kube-prometheus-stack` 이 이미 도입됨 (`k8s/infra/prod/monitoring/values.yaml`) — Tempo / OTel Collector 를 같은 namespace 에 추가하는 increment 작업
- ADR-0025 가 latency budget 측정 표준을 채택했으나 **drill-down 도구 부재**. 본 ADR 이 그 빈 자리를 채움
- 16개 서비스가 모두 Spring Boot 3.x + Micrometer 기반 (ADR-0019 K8s 마이그레이션 후 동일 base) → common 모듈 일괄 적용 가능
- ADR-0019 가 `discovery` 모듈을 제거하여 hop 구조가 단순화됨 (gateway → app → kafka/db) → trace 모델링 시 외부 의존성 적음

## Decision

### 1. 표준 채택 — OpenTelemetry (vendor-neutral)

**OpenTelemetry SDK + W3C Trace Context** 를 분산 trace 표준으로 채택한다. Datadog / NewRelic 등 vendor-specific agent 는 채택하지 않는다.

근거:
- Vendor lock-in 회피가 가장 큰 ROI (`study/docs/10-observability/08-opentelemetry-tracing.md` §1)
- Spring Boot 3.x 가 Micrometer Tracing Bridge 로 OTel 친화적
- CNCF Graduated 프로젝트 — 생태계 지속성

### 2. 백엔드 — Grafana Tempo (S3 backend)

**Tempo** 를 trace 백엔드로 채택. Jaeger / Zipkin 거부.

근거 (`study/docs/10-observability/08-opentelemetry-tracing.md` §6):

| 항목 | Jaeger | Tempo |
|---|---|---|
| Storage | Cassandra / ES | **S3 / GCS / Azure Blob** |
| 비용 | $$ | **$** (object storage) |
| Grafana 통합 | ○ | **◎ 네이티브** |
| Loki / Prometheus drill-down | △ | **✅** |

- 검색은 trace_id 로만 → 비용 폭락 (검색 인덱스는 Loki / Prometheus 가 담당)
- 이미 Grafana datasource sidecar 가 동작 중 (`grafana.sidecar.datasources.enabled=true`) → ConfigMap 추가만으로 datasource 등록

### 3. App 측 instrumentation — Micrometer Tracing Bridge

**Micrometer Tracing Bridge to OTel** 채택. Java Agent / Manual SDK / `@WithSpan` 은 보조.

근거:
- msa 16개 서비스가 모두 Spring Boot 3.x + Micrometer 의존 (`study/docs/10-observability/12-msa-current-state.md` §1.3)
- Bridge 는 build 시점 결정 — Java Agent 의 byte code instrumentation 부담 회피
- Spring Boot 3.x 의 자동 계측 대상이 풍부: HTTP server (Tomcat / Netty), HTTP client (RestTemplate / WebClient), JDBC, Spring Data Redis, Spring Kafka, gRPC

`common/build.gradle.kts` 에 추가:

```kotlin
implementation("io.micrometer:micrometer-tracing-bridge-otel")
implementation("io.opentelemetry:opentelemetry-exporter-otlp")
```

`common/src/main/resources/application.yml` (auto-configured):

```yaml
management:
  tracing:
    sampling:
      probability: 1.0          # head 100% — Collector 가 tail 결정
    propagation:
      type: w3c                 # traceparent 헤더 표준
  otlp:
    tracing:
      endpoint: http://otel-collector.monitoring.svc.cluster.local:4318/v1/traces
      timeout: 5s
```

서비스별 override 가능 (예: `quant` 의 paper trading dryrun 환경은 sampling 100%).

### 4. Sampling — Head 100% + Tail (error / slow / 1% probabilistic)

**2-Tier sampling** 채택 (`study/docs/10-observability/09-sampling-and-correlation.md` §3 권장 조합).

- **App head**: 모든 trace 의 sampled flag = `01` 로 설정 → 일단 보낸다
- **Collector tail**: error / slow / 1% probabilistic 만 백엔드 저장

`k8s/infra/prod/monitoring/otel-collector/values.yaml` (신규):

```yaml
processors:
  tail_sampling:
    decision_wait: 30s
    num_traces: 100000
    expected_new_traces_per_sec: 1000
    policies:
      - name: errors_always
        type: status_code
        status_code: { status_codes: [ERROR] }
      - name: slow_always
        type: latency
        latency: { threshold_ms: 1000 }
      - name: critical_endpoint_10pct
        type: and
        and:
          and_sub_policy:
            - name: endpoint
              type: string_attribute
              string_attribute:
                key: "http.target"
                values: [".*payment.*", ".*orders.*"]
                enabled_regex_matching: true
            - name: rate
              type: probabilistic
              probabilistic: { sampling_percentage: 10.0 }
      - name: trace_id_ratio_1pct
        type: probabilistic
        probabilistic: { sampling_percentage: 1.0 }
```

**환경별 sampling 정책**:

| 환경 | App head | Collector tail |
|---|---|---|
| `local` (k3d) | 100% | 100% (debugging) |
| `staging` | 100% | 100% (검증) |
| `prod` (현 규모, 1k req/s 이하) | 100% | error/slow + 1% probabilistic |
| `prod` (중규모 진입 후, 1k–100k req/s) | 100% | error/slow + 1% + 핵심 경로 10% |

> 결제 / 주문 / KEK 복호화 등 critical 경로는 endpoint 기반 추가 룰 (10%) 강제.

### 5. Trace ↔ Log ↔ Metric Correlation (3축 통합)

분산 trace 의 진짜 가치는 **신호 간 점프**. 6 방향 중 핵심 4 방향을 강제 구성.

#### 5.1 Metric → Trace (Exemplar)

Prometheus Exemplar 활성화 — Histogram bucket 안에 `trace_id` 를 끼워 보낸다.

```yaml
# k8s/infra/prod/monitoring/values.yaml (수정)
prometheus:
  prometheusSpec:
    enableFeatures:
      - exemplar-storage
```

App 측 활성화 (이미 ADR-0025 §4 가 강제하는 항목과 결합):

```yaml
management:
  metrics:
    distribution:
      percentiles-histogram:
        http.server.requests: true
      slo:
        http.server.requests: 50ms, 100ms, 200ms, 500ms, 1s, 2s
```

→ Grafana Heatmap panel 의 outlier diamond marker 클릭 → Tempo trace 점프.

#### 5.2 Trace → Logs (Tempo `tracesToLogs`)

`k8s/infra/prod/monitoring/datasources/tempo.yaml` (신규 ConfigMap):

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: tempo-datasource
  namespace: monitoring
  labels: { grafana_datasource: "1" }
data:
  tempo.yaml: |
    apiVersion: 1
    datasources:
      - name: Tempo
        type: tempo
        uid: tempo
        url: http://tempo:3100
        jsonData:
          tracesToLogs:
            datasourceUid: 'loki'        # ADR 후속 (Loki 도입 ADR) 가 채워줌
            tags: ['trace_id']
            spanStartTimeShift: '-5m'
            spanEndTimeShift: '5m'
            filterByTraceID: true
          tracesToMetrics:
            datasourceUid: 'prometheus'
            tags: [{ key: 'service.name', value: 'application' }]
          serviceMap:
            datasourceUid: 'prometheus'
```

#### 5.3 Logs → Trace (Loki `derivedFields`)

> ⚠️ Loki 도입은 별도 ADR (Observability ADR 후속) — 본 ADR 의 의존이 아니라 **사전 조건**. Loki 가 없으면 5.3 / 5.4 는 미동작이지만 5.1 / 5.2 는 동작.

#### 5.4 Trace → Metrics

Tempo `tracesToMetrics` (위 5.2 의 ConfigMap 에 포함) 가 Service Map / RED panel 자동 link.

### 6. Logback JSON + MDC trace propagation (`common` 표준)

OTel 만 도입하고 logback `%mdc{traceId}` 가 없으면 trace ↔ log drill-down 불가. **반드시 동시 적용** (`study/docs/10-observability/08-opentelemetry-tracing.md` §11.5 함정).

#### 6.1 `common/src/main/resources/logback-spring.xml` (신설)

```xml
<configuration>
  <springProperty name="serviceName" source="spring.application.name"/>

  <appender name="STDOUT_JSON" class="ch.qos.logback.core.ConsoleAppender">
    <encoder class="net.logstash.logback.encoder.LoggingEventCompositeJsonEncoder">
      <providers>
        <timestamp><fieldName>ts</fieldName></timestamp>
        <pattern>
          <pattern>{
            "service": "${serviceName}",
            "level": "%level",
            "logger": "%logger{40}",
            "thread": "%thread",
            "trace_id": "%mdc{traceId:-}",
            "span_id": "%mdc{spanId:-}",
            "msg": "%message"
          }</pattern>
        </pattern>
        <stackTrace><fieldName>exception</fieldName></stackTrace>
      </providers>
    </encoder>
  </appender>

  <root level="INFO">
    <appender-ref ref="STDOUT_JSON"/>
  </root>

  <springProfile name="local">
    <root level="DEBUG"/>
    <!-- local 은 plain text 유지 (콘솔 가독성) → 별도 console appender 권장 -->
  </springProfile>
</configuration>
```

추가 의존성 (`common/build.gradle.kts`):

```kotlin
implementation("net.logstash.logback:logstash-logback-encoder:7.4")
```

> Micrometer Tracing Bridge 가 trace_id / span_id 를 자동으로 MDC 에 put → `%mdc{traceId}` 그대로 동작.

#### 6.2 `common/src/main/kotlin/com/kgd/common/observability/TraceIdFilter.kt` (신설)

> Micrometer Bridge 가 자동 MDC 주입을 하지만, 외부 진입 시점에서 `traceparent` 헤더 없는 경우 fallback ID 생성 + response header 노출용으로 명시 Filter 1개를 추가한다.

```kotlin
package com.kgd.common.observability

@Order(Ordered.HIGHEST_PRECEDENCE)
class TraceIdFilter(private val tracer: Tracer) : OncePerRequestFilter() {
    override fun doFilterInternal(req: HttpServletRequest, res: HttpServletResponse, chain: FilterChain) {
        try {
            val current = tracer.currentSpan()?.context()
            val traceId = current?.traceId() ?: newTraceId()
            res.setHeader("X-Trace-Id", traceId)
            chain.doFilter(req, res)
        } finally {
            // MDC 정리는 Micrometer Bridge 가 처리
        }
    }
}
```

#### 6.3 `gateway/src/main/kotlin/com/kgd/gateway/filter/ReactiveTraceIdFilter.kt` (gateway 전용)

Webflux Reactor Context 전파:

```kotlin
@Component
@Order(-1000)
class ReactiveTraceIdFilter(private val tracer: Tracer) : WebFilter {
    override fun filter(exchange: ServerWebExchange, chain: WebFilterChain): Mono<Void> {
        val current = tracer.currentSpan()?.context()
        val traceId = current?.traceId() ?: newTraceId()
        exchange.response.headers.set("X-Trace-Id", traceId)
        return chain.filter(exchange)
    }
}
```

> `gateway/src/main/kotlin/com/kgd/gateway/filter/VisitorIdFilter.kt` 와 ordering 충돌 검증 필요.

#### 6.4 WebClient 자동 traceparent 헤더

Micrometer Tracing Bridge 가 `WebClient` 에 `ObservationFilter` 자동 등록 → `traceparent` 헤더 자동 주입. `common/src/main/kotlin/com/kgd/common/webclient/CommonWebClientAutoConfiguration.kt` 의 builder 가 이를 그대로 흡수.

검증 포인트:
- `WebClientBuilderFactory` 가 Micrometer Observation 등록 여부 — Spring Boot 3.x 기본 동작이지만 명시 테스트 필요
- `order` → `product` 호출 시 downstream 에서 trace_id 가 계속 이어지는지 e2e 검증

#### 6.5 Kafka header 전파 (`ProducerInterceptor` / `RecordInterceptor`)

`common/src/main/kotlin/com/kgd/common/kafka/TracingKafkaInterceptors.kt` (신설):

```kotlin
class TracingProducerInterceptor<K, V> : ProducerInterceptor<K, V> {
    override fun onSend(record: ProducerRecord<K, V>): ProducerRecord<K, V> {
        val ctx = Span.current().spanContext
        if (ctx.isValid) {
            record.headers().add("traceparent", w3cFormat(ctx).toByteArray())
        }
        return record
    }
}

class TracingConsumerRecordInterceptor<K, V> : RecordInterceptor<K, V> {
    override fun intercept(record: ConsumerRecord<K, V>): ConsumerRecord<K, V> {
        val tp = record.headers().lastHeader("traceparent")?.value()?.toString(Charsets.UTF_8)
        if (tp != null) {
            // OTel ContextPropagator 로 현재 Context 에 set
        }
        return record
    }
}
```

> Spring Kafka 의 OTel 자동 계측이 이미 일부 처리하므로 **검증 → 부족분만 보강** 순서로 진행.

#### 6.6 Coroutine 환경 (`quant`) 가이드

ADR-0024 (quant) 가 Kotlin Coroutine 기반. `Dispatchers.IO` 로 옮길 때 OTel context 동반 전파:

```kotlin
withContext(Dispatchers.IO + Context.current().asContextElement()) {
    // span 정상 전파
}

// 또는 MDCContext 명시
launch(MDCContext()) { ... }
```

`docs/conventions/logging.md` 에 Coroutine 섹션 추가 (본 ADR 의 후속 작업).

### 7. Trace attribute 표준 (Semantic Convention 준수)

OTel Semantic Convention 키만 사용 (custom 키 금지, vendor lock-in 위험):

| 키 | 의미 | 예시 |
|---|---|---|
| `http.method` | HTTP method | `POST` |
| `http.target` | path | `/api/orders/{id}` |
| `http.status_code` | response status | `200` |
| `db.system` | DB type | `mysql` |
| `db.statement` | SQL (sanitized) | `SELECT * FROM products WHERE id=?` |
| `messaging.system` | broker | `kafka` |
| `messaging.destination` | topic | `order.created` |
| `service.name` | 서비스명 | `${spring.application.name}` |

**비즈니스 attribute** 는 `com.kgd.{domain}.{key}` 네임스페이스로:
- `com.kgd.order.id`
- `com.kgd.product.category`
- `com.kgd.quant.symbol` (단, 카디널리티 룰 — `QuantMetrics.kt` 의 주석 참조)

### 8. Span 폭발 방지 룰

1. `@WithSpan` annotation 은 **외부 IO 경계 + 비즈니스 root** 에만 사용. 모든 메서드에 붙이는 것 금지
2. Auto-instrumentation 의 Spring AOP / Reactor / Lettuce / Hibernate 등 일부는 `application.yml` 로 비활성화 (`-Dotel.instrumentation.<name>.enabled=false`) — 운영 시점 결정
3. 한 trace 의 span 수 상한 1000 (Collector 에서 drop)
4. PII 가 attribute 에 들어가지 않도록 Collector `attributes` processor 로 sanitize

### 9. Rollout Plan

| Phase | 기간 | 작업 | 산출물 |
|---|---|---|---|
| **Phase 0** | 1 sprint (2주) | 인프라 — OTel Collector DaemonSet + Tempo (S3 backend) Helm install | `k8s/infra/prod/monitoring/otel-collector/`, `k8s/infra/prod/monitoring/tempo/` |
| **Phase 1** | 1 sprint | `common` instrumentation — micrometer-tracing-bridge-otel 의존 + auto-config + logback-spring.xml + TraceIdFilter | `common/build.gradle.kts`, `common/src/main/resources/logback-spring.xml`, `common/src/main/kotlin/com/kgd/common/observability/` |
| **Phase 2** | 1 sprint | 1차 서비스 적용 (`product`, `order`) + e2e 검증 (gateway → order → product → kafka → analytics 전체 trace) | 검증 보고서 |
| **Phase 3** | 2 sprint | 16개 서비스 점진 적용 + Coroutine (`quant`) / Webflux (`gateway`) 별도 검증 + Kafka interceptor 적용 | overlay 갱신 |
| **Phase 4** | 1 sprint | Sampling 정책 prod 전환 + Exemplar Heatmap dashboard + Runbook (`docs/runbooks/p99-burn-rate.md`) | dashboard JSON + runbook |
| **(선택)** | — | Loki 도입 (별도 ADR) 후 `tracesToLogs` 활성화 | — |

총 **5–6 sprint (10–12주)** 예상.

### 10. SLO / Error 룰

| SLI | 정의 | SLO | Alerting |
|---|---|---|---|
| OTel Collector 가용성 | `up{job="otel-collector"}` | 99.9% / 30d | warn @ 1pod down, page @ 0pod |
| Tempo 가용성 | `up{job="tempo"}` | 99.5% / 30d | warn @ 5m, page @ 15m |
| Trace 손실율 | dropped span % | < 1% | warn @ 5%, page @ 20% |
| App side trace export 실패율 | `otel.exporter.failed_total` | < 0.1% | warn @ 1%, page @ 10% |

> Alert rule 은 ADR 후속 SLO ADR (Sloth 도입) 에서 PrometheusRule 로 등록.

## Alternatives Considered

### Alternative 1: Java Agent 만 도입 (`-javaagent:opentelemetry-javaagent.jar`)

- **장점**: 코드 0줄. Spring / JDBC / Kafka / WebClient 자동 계측
- **거부 이유**:
  - Spring Boot 3.x + Micrometer 이미 도입 — Bridge 가 친화적 (`study/docs/10-observability/08-opentelemetry-tracing.md` §3.5 결정 매트릭스)
  - JVM 시작 시간 증가 (byte code instrumentation)
  - Coroutine / Webflux 환경 검증 부담은 어차피 동일

### Alternative 2: Jaeger backend (Cassandra / ES)

- **장점**: trace 검색 강함 ("이 user 가 어제 어떤 trace 만들었나" ad-hoc)
- **거부 이유**:
  - 저장 비용 — Cassandra / ES vs S3 (Tempo) 격차 큼
  - msa 가 ELK 미운영 → ES 재사용 가치 없음
  - Grafana 통합 — Tempo 가 네이티브, drill-down 우수

### Alternative 3: Zipkin

- **거부 이유**: legacy. 새 도입은 OTel 표준이 정답. Zipkin 은 OTel exporter 로 호환만 유지 가능

### Alternative 4: 자체 trace ID Filter 만 도입 (OTel SDK 없이)

- **장점**: 의존성 최소
- **거부 이유**:
  - Span 모델 / DAG 시각화 불가 → 운영 가치 ↓
  - W3C 표준 헤더 파싱 / 전파 / sampling 룰을 직접 구현 — bug-prone
  - vendor neutrality 명목만 — 실제로는 자체 표준 lock-in

### Alternative 5: Datadog APM

- **거부 이유**:
  - vendor lock-in
  - 비용 (host / span 기반 청구)
  - msa 의 운영 비용 / 자체 운영 역량 / OSS 친화 방향에 역행

### Alternative 6: 본 결정을 conventions/ 만으로 처리 (ADR 없이)

- **거부 이유**: 본 결정은 (a) 16개 서비스 일괄 적용, (b) 인프라 신설 (OTel Collector / Tempo), (c) Sampling 정책 강제, (d) PR 리뷰 시점의 "trace 첨부 권장" 거버넌스 — ADR-0026 §2 의 ripple effect 기준 명백 해당. ADR 의 거버넌스 (Status: Accepted) 가 필요

## Consequences

### Positive

- **Saga / 분산 흐름 가시성**: gateway → order → product → kafka → analytics 의 전체 trace 한 번에 시각화. 디버깅 30분 → 5분
- **ADR-0025 P99 alerting 의 root cause 분해**: alert 발화 시 hop 별 분해 가능 → fan-out tail 정확 식별
- **Vendor neutrality**: OTel 표준 → backend 교체 (Tempo → Jaeger / Datadog) 시 코드 변경 0
- **Exemplar 로 metric ↔ trace 즉시 점프**: Heatmap outlier diamond marker 클릭 한 번
- **Kafka 비동기 경계 trace 연속성**: Producer ↔ Consumer 가 W3C link 또는 동일 trace 로 결합
- **WebClient 외부 호출 자동 헤더**: `order` → `product` 호출의 trace 끊김 해결
- **로그 ↔ trace correlation 기반 마련**: 본 ADR 이 logback JSON + MDC 표준을 도입 → Loki 도입 ADR 이 즉시 활용

### Negative

- **Collector / Tempo 운영 부담 증가**: monitoring namespace 의 pod 수 증가, S3 bucket 1개 추가 (`msa-tempo`)
- **Sampling 정책 결정 필요**: prod 트래픽 증가 시 head/tail 재조정 — 분기마다 검토
- **PII 위험**: `http.url` 의 query string token 등이 attribute 에 들어갈 수 있음 → Collector sanitize processor 강제
- **Coroutine / Webflux 검증 부담**: `quant` (Coroutine), `gateway` (Reactor) 의 context 전파 e2e 검증 필요. Phase 2-3 에서 별도 시간 배정
- **App 메모리 / CPU 증가**: Micrometer Tracing Bridge 의 instrumentation overhead — 보통 5% 미만, 실측 필요
- **기존 stdout 의존 운영 도구 깨질 수 있음**: docker logs grep 같은 ad-hoc — local profile 은 plain text 유지로 mitigation
- **Trace 초기 학습 비용**: 운영자 / 개발자가 Tempo UI / Span 모델 / Sampling 의미 학습 필요 → Runbook + 1회 교육 세션

### Mitigation

- **Coroutine / Webflux** — Phase 2 / 3 에서 별도 검증 sprint, 가이드 문서 작성 (`docs/conventions/logging.md` 후속 갱신)
- **PII** — OTel Collector `attributes` processor 의 regex replace 강제 + PR 리뷰 룰 ("attribute 추가 시 PII 검토")
- **운영 부담** — kube-prometheus-stack 과 동일 namespace `monitoring` 에 배치, GitOps (Argo CD 미도입 — 별도 ADR) 패턴
- **비용** — Tempo S3 lifecycle 30d retention, Tail sampling 으로 raw 비용의 5–10% 수준 유지
- **서비스 점진 적용** — Phase 2 에서 1차 서비스 (`product`, `order`) e2e 검증 후 16개 점진. 일괄 강제 X

## Open Questions

- [ ] **Loki 도입 ADR 분리**: 본 ADR 은 trace + MDC 까지. Loki + Promtail 은 별도 ADR (Observability ADR 후속)
- [ ] **SLO + Sloth 도입 ADR**: 본 ADR 의 §10 Alert rule 이 의존하는 PrometheusRule 자동 생성 도구 — 별도 ADR
- [ ] **Pyroscope (Continuous Profiling)**: Trace 가 답 못하는 함수 단위 분석 — 본 ADR 안정화 후 검토 (보류)
- [ ] **Coroutine OTel instrumentation 검증**: quant 의 paper trading dryrun 환경에서 e2e
- [ ] **Webflux gateway 의 OTel reactor instrumentation 검증**: `WebFilter` ordering / `Reactor Context` 전파
- [ ] **Tempo S3 IAM 분리**: `msa-tempo` bucket 의 access policy + IRSA
- [ ] **PR 템플릿에 "Trace 첨부" 권장 항목 추가**: ADR-0025 의 "Latency Budget Impact" 섹션과 결합
- [ ] **`quant` 의 trade audit trace 와 ClickHouse `quant_audit` 의 결합**: trace_id 를 audit row 에 포함시켜 trace ↔ audit drill-down

## References

### 학습 자료 (study/)

- `study/docs/00-ADR-CANDIDATES.md` — ADR-0030 항목 (본 ADR 의 통합 ADR 후보), Top 1 cross-referenced
- `study/docs/10-observability/12-msa-current-state.md` — msa 현 상태 grep 증거 (OTel/MDC 0)
- `study/docs/10-observability/13-improvements.md` — ADR-X1 / X2 / X3 / X4 / X5 통합 로드맵
- `study/docs/10-observability/08-opentelemetry-tracing.md` — OTel API/SDK/Collector + W3C Context + 백엔드 비교
- `study/docs/10-observability/09-sampling-and-correlation.md` — Sampling 4종 + 3축 Correlation + Exemplar
- `study/docs/10-observability/06-logs-elk-vs-loki.md` — Loki 결정 근거 (후속 ADR)
- `study/docs/10-observability/07-structured-logging-correlation.md` — logback JSON 표준
- `study/docs/6-kafka/*-improvements.md` — Saga trace_id 요청
- `study/docs/7-distributed/*-improvements.md` — 분산 trace 요청
- `study/docs/8-system-design/*` — 시나리오별 trace
- `study/docs/11-k8s/*-improvements.md` — K8s 횡단 trace
- `study/docs/17-spring-web/*-improvements.md` — Filter / WebClient 자동 헤더

### 관련 ADR

- ADR-0015 (Resilience Strategy) — CircuitBreaker / DLQ / Rate Limiting 의 trace 가시성과 결합
- ADR-0019 (K8s Migration) — 배포 모드 이원화, common 모듈 일괄 적용 가능성의 전제
- ADR-0021 (`docs/conventions/logging.md`) — kotlin-logging 룰. 본 ADR 이 trace_id MDC 필드 추가
- ADR-0024 (quant) — Coroutine 기반 서비스의 OTel 검증 대상
- ADR-0025 (Latency Budget) — P99 SLA + 측정 표준. 본 ADR 이 root cause 분해 도구를 추가
- ADR-0026 (docs taxonomy) — 본 ADR 의 거버넌스 결정 근거

### 외부 표준 / 도구

- W3C Trace Context — https://www.w3.org/TR/trace-context/
- OpenTelemetry — https://opentelemetry.io/docs/
- OTel Collector tail sampling — https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor/tailsamplingprocessor
- Grafana Tempo — https://grafana.com/docs/tempo/latest/
- Micrometer Tracing — https://micrometer.io/docs/tracing
- OTel Semantic Conventions — https://github.com/open-telemetry/semantic-conventions

### 코드 인용

- `gateway/src/main/kotlin/com/kgd/gateway/filter/VisitorIdFilter.kt` — 기존 Webflux Filter ordering 검증 대상
- `common/src/main/kotlin/com/kgd/common/webclient/CommonWebClientAutoConfiguration.kt` — Micrometer Observation 자동 등록 검증
- `common/src/main/kotlin/com/kgd/common/webclient/WebClientBuilderFactory.kt` — Builder 가 trace 헤더 흡수
- `quant/app/src/main/kotlin/com/kgd/quant/infrastructure/metrics/QuantMetrics.kt` — 카디널리티 룰의 모범, 본 ADR 의 attribute 표준에서 참조
- `k8s/infra/prod/monitoring/values.yaml` — kube-prometheus-stack 설정 (exemplar-storage 추가 대상)
- `k8s/infra/prod/monitoring/servicemonitor-apps.yaml` — `part-of: commerce-platform` 라벨 자동 발견 패턴 (Tempo / Collector 도 동일 라벨 사용)
- `k8s/infra/prod/monitoring/dashboards/http-dashboard.json` — Heatmap + Exemplar panel 추가 대상 (별도 PR)
