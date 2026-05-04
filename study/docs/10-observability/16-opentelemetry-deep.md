---
parent: 10-observability
seq: 16
title: OpenTelemetry Deep — 3-pillar 통합 / SDK / Collector / Propagation / Sampling / Exemplar / Semantic Conventions / OTLP
type: deep-dive
created: 2026-05-05
updated: 2026-05-05
status: completed
related:
  - 99-concept-catalog.md
  - 08-opentelemetry-tracing.md
  - 09-sampling-and-correlation.md
  - 12-msa-current-state.md
  - 15-prometheus-internals.md
sources:
  - https://opentelemetry.io/docs/
  - https://opentelemetry.io/docs/specs/otel/
  - https://opentelemetry.io/docs/specs/otlp/
  - https://github.com/open-telemetry/semantic-conventions
  - https://www.w3.org/TR/trace-context/
  - https://www.w3.org/TR/baggage/
  - https://opentelemetry.io/docs/collector/
  - https://github.com/open-telemetry/opentelemetry-collector
  - https://opentelemetry.io/docs/instrumentation/java/automatic/
  - https://grafana.com/docs/tempo/latest/
catalog-row: "§D (OTel Collector / OTLP / Semantic Conventions / Resource vs Span attrs / Operator) + §C (SpanKind / W3C / Baggage / Span events·links / Logs SDK) + §G (Burn rate exemplar) — OTel 통합 모델 (★ → ✅)"
---

# 16. OpenTelemetry Deep — 3-pillar 통합 / SDK / Collector / Propagation / Sampling / Exemplar / Semantic Conventions / OTLP

> 카탈로그 매핑: §99 §D `OTel Collector pipeline` / `OTLP` / `Semantic Conventions` / `Resource vs Span attrs` / `OTel Operator`, §C `Span kind` / `W3C Trace Context` / `Baggage` / `Span events·links` / `OTel Logs SDK`, §G `Exemplar` (★ → ✅).
> 학습 시간 예상: ~3h · 자가평가 입구 레벨: B+

> §08 (Tracing 표준 + Java agent) 의 layer 아래. OpenTelemetry (OTel) 가 단순한 trace 라이브러리가 아니라 metrics + logs + traces 를 하나의 context 모델 + 하나의 wire protocol (OTLP) + 하나의 의미 표준 (Semantic Conventions) 으로 통합한 vendor-neutral 표준이라는 점이 본 글의 출발점. (1) 3-pillar 통합 모델, (2) SDK 의 Provider/Sampler/Exporter, (3) auto/manual instrumentation, (4) W3C Trace Context + Baggage propagation, (5) Collector 의 3-stage pipeline + multi-tenant, (6) head/tail sampling, (7) exemplar 로 metric↔trace 연결, (8) Semantic Conventions 가 cross-language 호환을 만드는 방식, (9) OTLP wire protocol, (10) msa 도입 시 SDK + Collector + Tempo / Prometheus / Loki 의 backend matrix 까지 다룬다. msa 의 trace 인프라 0 (#12) 에서 도입 PR 의 첫 단추가 될 ADR 의 grounding.

---

## 1. 한 줄 핵심

> **OpenTelemetry = "API + SDK + Collector + Propagation + Semantic Conventions + OTLP" 의 6가지 표준이 합쳐진 vendor-neutral 관측 데이터 프레임워크.**
> 코드는 OTel API 로만 짜면 backend 는 Jaeger / Tempo / Datadog / New Relic 등 자유 선택 (vendor lock-in 회피). 핵심은 traces 만이 아니라 **metrics + logs + traces 를 같은 trace_id / span_id / Resource attribute 로 묶는 통합 context** — 그래서 metric P99 alert 에서 trace 1건으로 점프하고, 그 trace 의 span 에서 그 시간대 log 로 점프하는 closed loop 가 가능해진다.

---

## 2. 등장 배경 — 표준 통합의 동기

### 2-1. 2016~2019 의 fragmented 세계

```
[Vendor A: Datadog]   ─── proprietary agent + 자체 wire format
[Vendor B: New Relic] ─── proprietary agent
[Open: Jaeger]        ─── jaeger-client (per-language)
[Open: Zipkin]        ─── brave / B3 propagation
[Open: OpenTracing]   ─── API only, no SDK
[Open: OpenCensus]    ─── Google 내부, API + SDK
```

문제:
- vendor 갈아탈 때 코드 재작성.
- propagation 표준 부재 — Jaeger 와 Zipkin 이 cross-service 호출 시 trace 이어지지 않음.
- metric / trace / log 가 따로따로 — context 연결 부재.

### 2-2. 합병 → CNCF Graduated

```
2019: OpenTracing (API) + OpenCensus (SDK) → 합병 = OpenTelemetry
2021: CNCF Incubating
2023: Tracing GA, Metrics GA
2024+: Logs GA (3-pillar 완성)
```

→ 현재 (2026) OTel 은 traces / metrics / logs 모두 GA. 면접에서 "최신 표준" 의 정답.

### 2-3. msa 컨텍스트

`#12` 가 정리한 현 상태: trace 인프라 0, MDC (Mapped Diagnostic Context, 매핑 진단 컨텍스트) 0, log 수집 0. 도입할 거면 vendor 의 proprietary agent 가 아니라 OTel 표준 — 이 결정의 근거가 본 글의 §13.

---

## 3. 3-pillar 통합 모델 — 왜 OTel 인가

### 3-1. metrics + logs + traces 가 같은 context

```
Trace (요청 1건의 인과 그래프)
  ├─ trace_id, span_id      ← 모든 시그널이 공유
  ├─ Resource (service.name, k8s.pod.name, ...)  ← 모든 시그널이 공유
  └─ Spans
       ├─ Attributes (http.method, db.statement, ...)
       ├─ Events (span 안의 시점 로그)
       └─ Links (다른 trace 와 연결)

Metrics
  └─ Exemplar (sample 1개에 trace_id 첨부)

Logs
  └─ trace_id / span_id 필드
```

→ Grafana 의 typical 동선:
1. metric P99 alert 가 발화.
2. metric panel 의 exemplar 클릭 → 그 시간대 trace 1건으로 점프.
3. trace 의 slow span 에서 "그 시간대 log" 버튼 → Loki 의 trace_id filter 자동.

이 closed loop 가 OTel 의 가장 큰 ROI (Return On Investment, 투자 대비 수익).

### 3-2. signal 별 데이터 모델

| Signal | 핵심 표현 | OTel 모델 |
|---|---|---|
| Traces | span tree | Span(name, kind, attrs, events, links, status, start/end) |
| Metrics | time series | Counter / UpDownCounter / Histogram / Gauge / ObservableX |
| Logs | log record | LogRecord(severity, body, attrs, trace_id, span_id) |

3가지 모두 `Resource` (process / service identity) + `InstrumentationScope` (어느 라이브러리) 를 공통으로 보유.

### 3-3. Resource vs Attribute 의 차이

> **Resource = "이 시그널을 누가 만들었는가" (process identity)**
> **Attribute = "이 시그널이 무엇에 대해 말하는가" (event 컨텍스트)**

```
Resource:
  service.name = "order-service"
  service.version = "1.4.2"
  k8s.cluster.name = "prod-eu"
  k8s.namespace.name = "commerce"
  k8s.pod.name = "order-7d4f-x8k2l"
  host.name = "ip-10-0-1-12"

Span Attributes (span 마다 다름):
  http.method = "POST"
  http.route = "/orders"
  http.status_code = 201
  db.system = "mysql"
  db.statement = "INSERT INTO orders ..."
```

→ Resource 는 Process 시작 시 1회 결정, span 마다 안 바뀜. Attribute 는 span 마다.

→ Prometheus 라벨 모델로 환산 시 Resource 는 외부 라벨 (target / job), Attribute 는 metric 라벨. 구분 안 하면 cardinality 폭증.

---

## 4. SDK 구조 — Provider / Processor / Exporter

### 4-1. 전체 흐름

```
[application code]
        │  OTel API (TracerProvider.get("name")) ← 코드는 API 만 의존
        ▼
[OTel SDK]
   ┌─────────────────────────────────────────┐
   │ TracerProvider                          │
   │   ├─ Sampler (parent/probabilistic/...) │
   │   ├─ SpanProcessor (Batch / Simple)     │
   │   │     └─ Exporter (OTLP / Jaeger / Z) │
   │   └─ Resource (service.name, k8s.*)     │
   ├─────────────────────────────────────────┤
   │ MeterProvider                           │
   │   ├─ MetricReader (Periodic / Pull)     │
   │   │     └─ Exporter (OTLP / Prometheus) │
   │   └─ View (instrument 변환 룰)          │
   ├─────────────────────────────────────────┤
   │ LoggerProvider                          │
   │   └─ LogRecordProcessor / Exporter      │
   └─────────────────────────────────────────┘
        │  OTLP gRPC/HTTP
        ▼
[OTel Collector] → backends
```

### 4-2. TracerProvider — Tracer 의 factory

```kotlin
// SDK 부트스트랩 (보통 application 시작 시 1회)
val sdk = OpenTelemetrySdk.builder()
    .setTracerProvider(
        SdkTracerProvider.builder()
            .setResource(
                Resource.create(
                    Attributes.builder()
                        .put("service.name", "order-service")
                        .put("service.version", "1.4.2")
                        .build()
                )
            )
            .setSampler(Sampler.parentBased(Sampler.traceIdRatioBased(0.1)))
            .addSpanProcessor(
                BatchSpanProcessor.builder(
                    OtlpGrpcSpanExporter.builder()
                        .setEndpoint("http://otel-collector:4317")
                        .build()
                ).build()
            )
            .build()
    )
    .setPropagators(
        ContextPropagators.create(W3CTraceContextPropagator.getInstance())
    )
    .buildAndRegisterGlobal()

// 사용
val tracer = GlobalOpenTelemetry.getTracer("com.kgd.order")
val span = tracer.spanBuilder("createOrder").startSpan()
try {
    span.makeCurrent().use { _ ->
        // ...
    }
} finally {
    span.end()
}
```

### 4-3. Sampler 종류

| Sampler | 의미 |
|---|---|
| `AlwaysOn` | 100% 샘플 (개발용) |
| `AlwaysOff` | 0% (드물게) |
| `TraceIdRatioBased(p)` | trace_id 의 hash 로 비율 결정 (head sampling) |
| `ParentBased(root, ...)` | parent 가 sample 되면 따라감, root 만 정책 |
| `Composite` | 사용자 정의 조합 |

권장: `parentBased(traceIdRatioBased(0.1))` — root span 만 비율 샘플, 자식은 부모 결정 따름. 이게 cross-service trace 일관성의 표준.

### 4-4. SpanProcessor — Batch vs Simple

| Processor | 의미 |
|---|---|
| `SimpleSpanProcessor` | span end 즉시 export (저성능, 디버그) |
| `BatchSpanProcessor` | 큐에 모았다가 batch export (운영 표준) |

BatchSpanProcessor 옵션:
- `maxQueueSize` (default 2048): 큐 capacity. 초과 시 drop.
- `scheduledDelay` (default 5s): batch 주기.
- `maxExportBatchSize` (default 512): 한 export 의 span 수.
- `exportTimeout` (default 30s).

→ 큐가 차면 새 span drop. 운영 시 `otel.batch.queue.dropped` 메트릭 모니터.

### 4-5. MeterProvider + View — Counter / Histogram

```kotlin
val meter = sdk.meterProvider.get("com.kgd.order")
val orderCreated = meter.counterBuilder("order.created.total")
    .setDescription("Total orders created")
    .setUnit("1")
    .build()

orderCreated.add(1, Attributes.of(stringKey("status"), "PAID"))
```

View 는 instrument → metric 변환 룰:
- attribute filtering (cardinality 제거).
- aggregation 변경 (Histogram → ExponentialHistogram).
- 이름 rename.

```kotlin
SdkMeterProvider.builder()
    .registerView(
        InstrumentSelector.builder().setName("http.server.duration").build(),
        View.builder()
            .setAggregation(Aggregation.explicitBucketHistogram(
                listOf(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0)
            ))
            .build()
    )
    .build()
```

→ Prometheus Histogram bucket 을 view 로 통제.

### 4-6. LoggerProvider — Logs SDK (3rd pillar)

```kotlin
val logger = sdk.logsBridge.get("com.kgd.order")
logger.logRecordBuilder()
    .setSeverity(Severity.ERROR)
    .setBody("Order create failed")
    .setAttribute(stringKey("error.type"), e.javaClass.name)
    .emit()
```

실제로는 SLF4J / Logback / log4j 의 OTel appender 가 자동 변환 — 코드 변경 거의 없음.

```xml
<!-- logback-spring.xml -->
<appender name="OTel" class="io.opentelemetry.instrumentation.logback.appender.v1_0.OpenTelemetryAppender"/>
<root level="INFO">
    <appender-ref ref="STDOUT"/>
    <appender-ref ref="OTel"/>
</root>
```

---

## 5. Instrumentation — Auto vs Manual

### 5-1. Auto-instrumentation (Java agent)

```bash
java -javaagent:opentelemetry-javaagent.jar \
     -Dotel.service.name=order-service \
     -Dotel.exporter.otlp.endpoint=http://otel-collector:4317 \
     -jar order-app.jar
```

agent 가 startup 시 bytecode 를 변환:
- Spring MVC / WebFlux 의 controller method → SERVER span 자동.
- `RestTemplate` / `WebClient` / `HttpClient` → CLIENT span.
- JDBC / R2DBC → CLIENT span (db.statement attribute).
- Kafka producer / consumer → PRODUCER / CONSUMER span.
- Redis / Lettuce → CLIENT span.

장점:
- 코드 수정 0 — 즉시 trace 발생.
- 70+ 개 라이브러리 자동 지원.

단점:
- 컨테이너 이미지에 agent.jar + flag 필요.
- attribute 가 너무 많거나 적음 — 튜닝 필요.
- bytecode 변환이라 startup 미세 지연 (~100ms).

### 5-2. Spring Boot Starter (대안)

```kotlin
// build.gradle.kts
implementation("io.opentelemetry.instrumentation:opentelemetry-spring-boot-starter:2.x")
```

장점:
- agent.jar 불필요, application.properties 로 설정.
- Spring Boot AutoConfiguration 으로 통합.

단점:
- agent 보다 라이브러리 커버리지 적음 (Spring 생태계 위주).
- 일부 (예: 비-Spring MVC HTTP 클라이언트) 는 manual.

→ msa 는 16개 모두 Spring Boot 라 starter 가 자연스러움.

### 5-3. Manual instrumentation

도메인 로직에 명시 span:

```kotlin
class OrderService(private val tracer: Tracer) {
    fun createOrder(req: CreateOrderRequest): Order {
        val span = tracer.spanBuilder("OrderService.createOrder")
            .setSpanKind(SpanKind.INTERNAL)
            .setAttribute("order.user_id", req.userId)
            .setAttribute("order.item_count", req.items.size.toLong())
            .startSpan()
        return try {
            span.makeCurrent().use { _ ->
                val order = doCreate(req)
                span.setAttribute("order.total_amount", order.total.toDouble())
                span.setStatus(StatusCode.OK)
                order
            }
        } catch (e: Exception) {
            span.recordException(e)
            span.setStatus(StatusCode.ERROR, e.message ?: "")
            throw e
        } finally {
            span.end()
        }
    }
}
```

규칙:
- 도메인 의미 (`order.total_amount`) 가 있는 attribute 를 추가.
- 실패 시 `recordException` + `setStatus(ERROR)`.
- `try-finally` 로 `span.end()` 보장.
- `makeCurrent` + `use` 로 child span 자동 부모 설정.

→ Auto + Manual 혼합이 표준. Auto 가 HTTP/DB/Kafka 무료 처리, Manual 이 도메인 attribute 보강.

### 5-4. SpanKind 5종 — 의미와 backend 처리

| Kind | 시점 | backend (Jaeger/Tempo) 표시 |
|---|---|---|
| `SERVER` | incoming HTTP / gRPC | "받은 요청" |
| `CLIENT` | outgoing HTTP / gRPC / DB | "한 호출" |
| `PRODUCER` | Kafka / RabbitMQ publish | "발행" |
| `CONSUMER` | Kafka / RabbitMQ consume | "소비" |
| `INTERNAL` | 함수 내부 | "내부" |

비대칭 주의: PRODUCER 와 CONSUMER 는 시간차가 커서 **부모-자식이 아니라 link** 로 연결되는 게 표준. messaging 도메인 의 표준 패턴.

---

## 6. Context Propagation — W3C Trace Context + Baggage

### 6-1. 왜 표준화가 필요한가

```
[gateway] ──HTTP──▶ [order-service] ──HTTP──▶ [payment-service]
            │                          │
            ▼                          ▼
       traceparent: ?           traceparent: ?
```

각 서비스가 다른 라이브러리 / 다른 언어 / 다른 vendor agent 를 써도 trace 가 이어지려면 **wire format** 표준이 필요. 그게 W3C Trace Context (2020 표준).

### 6-2. traceparent 헤더

```
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
              │   │                                │                │
              │   │                                │                └─ trace flags (1 byte hex)
              │   │                                │                   bit 0: sampled
              │   │                                └─ parent-id (span_id, 8 byte)
              │   └─ trace-id (16 byte)
              └─ version (00 = current)
```

전송 측:
- 새 SERVER span 생성 시 incoming traceparent 의 trace_id 를 그대로, parent-id 를 자기 span_id 로.
- 수신 측은 parent-id 를 자기 span 의 parent 로 설정.

→ trace_id 의 hex 16 byte 가 cluster-wide 유니크. 모든 서비스가 같은 trace_id 를 보면 같은 trace.

### 6-3. tracestate 헤더 — vendor 메타데이터

```
tracestate: vendora=t61rcWkgMzE,vendorb=value;k1=v1
```

- vendor 별 sampling 결정 등 추가 메타.
- 32 entries 한도, 256 char per entry.
- OTel SDK 가 자동 파싱.

### 6-4. Baggage 헤더 — cross-service application context

```
baggage: userId=42,tenantId=acme,featureFlag.checkout=B
```

- application 이 정의한 key/value 가 모든 downstream 서비스로 전파.
- span attribute 로 자동 추가는 ❌ — 명시적으로 attribute 옮겨야.
- **민감정보 금지** — wire 로 흐른다.
- 용도: A/B 테스트 그룹, tenantId, debug flag.

```kotlin
// gateway 에서 baggage 설정
Baggage.builder()
    .put("tenant_id", req.tenantId)
    .put("ab_group", "B")
    .build()
    .makeCurrent().use {
        // 호출. baggage 가 traceparent 와 같이 전파됨
    }

// downstream 에서 read
val baggage = Baggage.current()
val tenantId = baggage.getEntryValue("tenant_id")
```

### 6-5. B3 (Zipkin) legacy

```
b3: 4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-1
또는
X-B3-TraceId: ...
X-B3-SpanId: ...
X-B3-Sampled: 1
```

- Zipkin / Spring Cloud Sleuth 의 표준이었음.
- OTel 도 propagator 에 등록 가능 — legacy 시스템과 공존 시.

```kotlin
ContextPropagators.create(
    TextMapPropagator.composite(
        W3CTraceContextPropagator.getInstance(),
        B3Propagator.injectingMultiHeaders()
    )
)
```

→ msa 는 vendor mix 없으니 W3C 단일.

### 6-6. propagator 의 통합 위치

- **HTTP**: `traceparent` / `tracestate` / `baggage` 헤더 자동 주입 (auto instrumentation).
- **gRPC**: metadata 로 같은 키.
- **Kafka**: record headers — OTel auto-instrumentation 이 자동 inject/extract.
- **MQ / Pub/Sub**: 메시지 headers / attributes.

→ Auto instrumentation 하나만 깔리면 propagation 자동. Manual 시에는 각 client 에서 propagator inject.

---

## 7. OTel Collector — Receiver / Processor / Exporter pipeline

### 7-1. 왜 Collector 인가

application 이 직접 backend 에 export 해도 되지만 Collector 를 두면:
1. **fan-out**: 한 app 의 데이터를 여러 backend (Tempo + Datadog + Honeycomb) 로 동시 송신.
2. **buffering / retry**: app 이 재시작해도 Collector 가 buffer.
3. **transform**: PII 마스킹, attribute 정리, cardinality 제어.
4. **sampling (tail-based)**: app 단계에선 모르는 "전체 trace" 정보로 샘플링.
5. **multi-tenant**: 한 Collector 가 여러 service 데이터 받아서 tenant 별 routing.
6. **vendor independence**: backend 갈아탈 때 app 재배포 안 함, Collector 만 변경.

### 7-2. 3-stage pipeline

```
[Receiver] → [Processor 1] → [Processor 2] → ... → [Exporter]
```

| stage | 역할 |
|---|---|
| Receiver | 데이터 수신 (OTLP / Prometheus / Jaeger / Zipkin / Filelog / Kafka) |
| Processor | 변환 (batch / attributes / resource / tail_sampling / filter / transform) |
| Exporter | 외부 송신 (OTLP / Prometheus / Loki / Tempo / Jaeger / file / kafka) |

설정 예:

```yaml
receivers:
  otlp:
    protocols:
      grpc: { endpoint: 0.0.0.0:4317 }
      http: { endpoint: 0.0.0.0:4318 }
  prometheus:
    config:
      scrape_configs:
        - job_name: legacy-app
          static_configs: [{ targets: ['legacy:9090'] }]

processors:
  batch:
    send_batch_size: 1024
    timeout: 10s
  memory_limiter:
    check_interval: 1s
    limit_mib: 1024
  attributes:
    actions:
      - key: http.url
        action: delete                       # PII 가능, 제거
      - key: deployment.environment
        value: prod
        action: insert
  resource:
    attributes:
      - key: service.namespace
        value: commerce
        action: insert
  tail_sampling:
    decision_wait: 10s
    num_traces: 100000
    policies:
      - name: error-spans
        type: status_code
        status_code: { status_codes: [ERROR] }
      - name: slow-spans
        type: latency
        latency: { threshold_ms: 1000 }
      - name: random-1pct
        type: probabilistic
        probabilistic: { sampling_percentage: 1 }

exporters:
  otlp/tempo:
    endpoint: tempo.monitoring.svc:4317
    tls: { insecure: true }
  prometheusremotewrite:
    endpoint: http://mimir:9090/api/v1/push
  loki:
    endpoint: http://loki:3100/loki/api/v1/push
  logging:
    loglevel: warn

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, tail_sampling, attributes, batch]
      exporters: [otlp/tempo]
    metrics:
      receivers: [otlp, prometheus]
      processors: [memory_limiter, batch]
      exporters: [prometheusremotewrite]
    logs:
      receivers: [otlp]
      processors: [memory_limiter, attributes, batch]
      exporters: [loki]
```

→ traces / metrics / logs 가 각자 pipeline. 같은 Collector 가 3개 동시 처리.

### 7-3. memory_limiter — 필수 1순위 processor

- Collector 자기 자신의 OOM (Out Of Memory, 메모리 부족) 방어.
- limit 에 가까워지면 새 데이터 reject.
- 모든 pipeline 의 첫 processor 로 권장.

### 7-4. batch — Throughput 핵심

- 모았다가 batch send → CPU / network 절약.
- `send_batch_size` (default 8192), `timeout` (default 200ms).
- batch 후 export 라서 latency = batch 시간 추가. 운영 표준.

### 7-5. attributes / resource / transform

| processor | 의미 |
|---|---|
| `attributes` | span attribute 추가/삭제/변경 |
| `resource` | resource attribute 변경 |
| `transform` | OTTL (OpenTelemetry Transformation Language) 로 복잡한 변환 |

OTTL 예 (cardinality 응급):

```yaml
transform:
  trace_statements:
    - context: span
      statements:
        - replace_pattern(attributes["http.url"], "/users/[0-9]+", "/users/{id}")
```

→ path variable 정규화.

### 7-6. tail_sampling — 후처리 샘플링

head sampling (SDK 단계, root span 결정) 의 한계:
- 결정 시점에 trace 가 어떻게 끝날지 모름 → 에러 trace 도 일률 1% 샘플 → drop 가능.

tail sampling (Collector 단계, 모든 span 본 후 결정):
- 같은 trace_id 의 모든 span 을 `decision_wait` 동안 buffer.
- policy 평가 — error / slow / random / rate-limit 결합.
- buffer 한 trace 만 export, 나머지 drop.

policy 종류:
- `status_code`: ERROR span 있는 trace.
- `latency`: 임계 ms 이상.
- `probabilistic`: 비율.
- `rate_limiting`: spans/sec 한도.
- `string_attribute`: 특정 라벨 값.
- `composite`: 조합.

부담:
- decision_wait (보통 10s) 동안 모든 span 메모리 buffer → Collector RAM 폭증.
- 1억 span/일 규모면 Collector 자체가 4~8 core / 16GB.

### 7-7. Collector 배포 패턴 — agent vs gateway

```
[App] ─OTLP─▶ [Agent Collector (DaemonSet)] ─OTLP─▶ [Gateway Collector (Deployment)] ─▶ Backend
```

| 패턴 | 역할 |
|---|---|
| **Agent (DaemonSet)** | 노드별 1개. local retry / batching. application 에 가까움. |
| **Gateway (Deployment)** | cluster 별 N 개. tail sampling / cross-app aggregation. backend 에 가까움. |

권장: **agent + gateway** 2-tier. 작은 cluster 면 gateway 만으로도 가능.

→ msa Phase 1 은 gateway 1대 만으로 시작 가능.

---

## 8. Sampling 전략 — head vs tail

### 8-1. head sampling (SDK 단계)

- root span 생성 시점에 trace_id hash 로 결정.
- 모든 자식 span 이 부모 결정 따름 (parent-based).
- 장점: 결정이 쉽고 cluster 일관.
- 단점: 에러 / 느린 trace 모름.

권장: `parentBased(traceIdRatioBased(0.1))` — 10% root 샘플.

### 8-2. tail sampling (Collector 단계)

- 모든 span 을 buffer 한 후 결정.
- 장점: 에러 / 느린 trace 100% 보존.
- 단점: Collector RAM / CPU 비용.

```yaml
tail_sampling:
  decision_wait: 10s
  policies:
    - { name: errors,  type: status_code, status_code: {status_codes: [ERROR]} }
    - { name: slow,    type: latency, latency: {threshold_ms: 500} }
    - { name: random,  type: probabilistic, probabilistic: {sampling_percentage: 1} }
```

→ 에러 100% + 500ms+ 100% + 나머지 1%.

### 8-3. probabilistic sampling 의 분산 일관성

trace_id 의 hash 기반이라 cluster 모든 노드가 같은 결정 → trace 단일 keep/drop. 이게 cross-service 일관성의 핵심.

### 8-4. msa 의 시작 권장값

- Phase 1: head 100% (개발/검증). Collector → Tempo.
- Phase 2: head parentBased(traceIdRatioBased(0.1)) + tail (errors + slow). 운영.
- Phase 3: tier 별 분리 (Tier 1 = 10%, Tier 2 = 1%).

---

## 9. Exemplar — Metric ↔ Trace 연결

### 9-1. 무엇인가

> **Exemplar = 메트릭의 한 sample 에 첨부된 trace_id sample 1개.**

Histogram bucket 의 한 증가가 일어날 때, 그 호출의 trace_id 를 sample 로 같이 저장. Prometheus / Tempo / Grafana 가 협력해서 metric panel 에서 점프 가능.

### 9-2. exposition format (OpenMetrics)

```
http_server_requests_seconds_bucket{le="0.05"} 24054 # {trace_id="3a72fd1a..."} 0.045 1714617600
                                                       └─ Exemplar
```

Prometheus 가 `--enable-feature=exemplar-storage` 일 때 저장.

### 9-3. Spring Boot / Micrometer 활성

```yaml
management:
  metrics:
    distribution:
      percentiles-histogram:
        http.server.requests: true
    enable:
      jvm: true
  tracing:
    sampling:
      probability: 0.1                       # 10% head sampling
  otlp:
    tracing:
      endpoint: http://otel-collector:4318/v1/traces
```

Micrometer 1.10+ + Spring Boot 3.x 에서 자동.

→ exemplar 가 동작하려면 (1) percentiles-histogram=true, (2) Prometheus exemplar-storage 활성, (3) trace 발생 (OTel SDK), (4) Grafana datasource 의 exemplar 옵션 활성, 4가지 모두 필요.

### 9-4. Grafana 동선

1. metric panel 의 latency 그래프에 점 (◆) 표시.
2. 클릭 → trace_id 복사.
3. Tempo / Jaeger 데이터소스로 자동 점프.
4. trace 의 slow span 표시.

→ ADR-0025 의 metric→trace 점프 강제는 이 4단계가 동작해야 의미. msa 는 #12 기준 (1)(2)(3) 모두 미적용 → 본 ADR 의 첫 milestone.

---

## 10. Semantic Conventions — cross-language 호환의 지반

### 10-1. 표준 attribute 네임스페이스

OTel 가 도메인별 attribute 키 + 의미를 표준화:

| 도메인 | 핵심 키 |
|---|---|
| HTTP | `http.method`, `http.route`, `http.status_code`, `url.full`, `url.path`, `client.address`, `server.address` |
| RPC | `rpc.system`, `rpc.service`, `rpc.method`, `rpc.grpc.status_code` |
| DB | `db.system`, `db.name`, `db.statement`, `db.operation`, `db.user` |
| Messaging | `messaging.system`, `messaging.destination.name`, `messaging.kafka.consumer.group`, `messaging.kafka.partition` |
| FaaS | `faas.invocation_id`, `faas.trigger`, `faas.coldstart` |
| Cloud | `cloud.provider`, `cloud.region`, `cloud.availability_zone` |
| Container / k8s | `container.name`, `k8s.namespace.name`, `k8s.pod.name`, `k8s.deployment.name` |
| Process | `process.pid`, `process.runtime.name`, `process.runtime.version` |
| Service | `service.name`, `service.version`, `service.instance.id`, `service.namespace` |

### 10-2. 왜 중요한가

같은 키를 모든 라이브러리 / 모든 언어 / 모든 vendor 가 쓰면:
- **Grafana 대시보드 portable**: `http.method`, `http.status_code` 가 공통이라 한 dashboard JSON 이 모든 서비스 적용.
- **Backend tooling**: Jaeger 의 service map, Tempo 의 span query 가 표준 attribute 로 작동.
- **Alert query portable**: PromQL 에서 `http_server_request_duration_seconds{http_response_status_code="500"}` 가 cross-service.

### 10-3. 권장 vs 선택

각 attribute 가 `Required` / `Recommended` / `Optional` 로 표기. auto-instrumentation 이 거의 다 채움.

manual 도 표준 키 우선:

```kotlin
span.setAttribute("messaging.system", "kafka")
span.setAttribute("messaging.destination.name", "product.item.created")
span.setAttribute("messaging.kafka.partition", 5L)
```

vs 비표준:

```kotlin
span.setAttribute("kafka.topic", "product.item.created")     // ❌ 비표준
```

### 10-4. msa attribute 추가 표준 — 후보

```kotlin
// 도메인 attribute (semantic conv 위에 commerce 도메인 추가)
"commerce.tenant.id"     // 멀티테넌시
"commerce.user.id"       // (high-cardinality 주의)
"commerce.order.status"  // CREATED / PAID / SHIPPED / ...
"commerce.product.sku"
```

→ commerce.* 네임스페이스를 제안 ADR 후보 (#12 ADR 발견 패턴).

### 10-5. version 관리

Semantic Conventions 도 versioned (1.20.0 / 1.25.0 ...). attribute 가 rename 되거나 deprecated 되면 SDK upgrade 시 영향. backend (Tempo / Mimir) 도 같은 버전 따라가야 query 호환.

---

## 11. OTLP — 표준 wire protocol

### 11-1. 정의

**OTLP (OpenTelemetry Protocol)** = OTel 의 wire format 표준.
- gRPC (port 4317, default) 또는 HTTP/protobuf (port 4318).
- protobuf 직렬화 — `Resource` / `InstrumentationScope` / signal 들.
- traces / metrics / logs 같은 schema 로 통합.

### 11-2. 구조

```
ExportTraceServiceRequest:
  resource_spans:[]:
    resource: {attributes: [{key, value}]}
    scope_spans:[]:
      scope: {name, version}
      spans:[]:
        trace_id, span_id, parent_span_id
        name, kind, start_time, end_time
        attributes: [{key, value}]
        events:[], links:[], status
```

→ 모든 backend 가 OTLP receiver 만 있으면 OTel SDK / Collector 와 즉시 연동.

### 11-3. gRPC vs HTTP 선택

| 채널 | 권장 |
|---|---|
| gRPC (4317) | cluster 내부 (HTTP/2 streaming, 효율) |
| HTTP/protobuf (4318) | 방화벽 / 인증 / 게이트웨이 통과 (REST) |
| HTTP/json | 디버그 / 작은 트래픽 |

기본은 gRPC. 외부 SaaS backend (e.g., Honeycomb, Datadog) 는 HTTP 가 보통.

### 11-4. 압축

gRPC 의 gzip / zstd. 보통 50~70% 절감. 운영 권장.

```yaml
exporters:
  otlp:
    endpoint: tempo:4317
    compression: gzip
```

### 11-5. retry / queue

OTLP exporter 의 retry + sending_queue 구성:

```yaml
exporters:
  otlp:
    endpoint: tempo:4317
    sending_queue:
      enabled: true
      num_consumers: 4
      queue_size: 5000
    retry_on_failure:
      enabled: true
      initial_interval: 5s
      max_interval: 30s
      max_elapsed_time: 5m
```

→ 일시 backend 장애를 5분까지 흡수.

---

## 12. OTel vs 기존 — 비교

### 12-1. OTel vs Prometheus

| 측면 | Prometheus | OTel Metrics |
|---|---|---|
| 모델 | pull | push (OTLP) |
| 인스트루먼트 | metric_relabel 단계 | View 단계 |
| Histogram | bucket-based | bucket + ExponentialHistogram |
| context 연결 | exemplar (OpenMetrics 확장) | trace_id/span_id 내장 |
| backend | Prometheus / Mimir | OTLP → Prometheus / Mimir / 등 |

→ 공존 가능. Spring Boot Actuator + Micrometer 의 prometheus + OTLP 동시 export 가능.

### 12-2. OTel vs Jaeger / Zipkin

| 측면 | Jaeger | Zipkin | OTel |
|---|---|---|---|
| 모델 | tracing only | tracing only | 3 pillar |
| propagation | Jaeger | B3 | W3C Trace Context |
| API/SDK | jaeger-client | brave | OTel SDK |
| 현재 표준 | Jaeger backend → OTel 수신 | legacy | 표준 |

→ 현재 (2026) Jaeger 도 OTel SDK 권장, jaeger-client 는 deprecated. Zipkin 도 OTel 으로 마이그레이션 권장.

### 12-3. OTel vs Spring Cloud Sleuth

- Sleuth = Spring 생태계의 trace 라이브러리. B3 propagation.
- Spring Boot 3.x 부터 Micrometer Tracing 으로 통합 → OTel bridge.
- 새 서비스: OTel 직접 / Micrometer Tracing 둘 다 OK. 기존 Sleuth 는 OTel 으로 마이그레이션.

→ msa 는 Sleuth 도 안 들어와 있어 (`#12` 기준) — OTel 직접 도입이 깔끔.

---

## 13. msa 적용 — 도입 ADR 의 grounding

### 13-1. 현 상태 (#12 인용)

```
- OpenTelemetry / Sleuth / Brave / Tempo 미도입. Trace 인프라 0.
- MDC / trace ID 전파 코드 0.
- logback-spring.xml 0개.
- Loki / ELK 미도입.
- Spring Boot Actuator + Micrometer 16개 서비스 도입.
```

→ OTel 도입은 0 → 1 이라 ADR 의 영향이 큼.

### 13-2. 도입 backend 매트릭스

| signal | backend | 이유 |
|---|---|---|
| traces | Grafana Tempo | OSS, S3 사용 가능, Grafana 통합 |
| metrics | 기존 Prometheus + (선택) Mimir | 이미 도입, OTel SDK 가 OTLP push 또는 expose 양립 |
| logs | Grafana Loki | label-based, S3 가능, Grafana 통합 |

→ Grafana 스택 통일 (Loki / Tempo / Mimir / Grafana) 이 운영 단순.

### 13-3. SDK 도입 옵션

| 옵션 | 장점 | 단점 |
|---|---|---|
| Java agent | 코드 0 변경, 70+ 라이브러리 | 이미지에 jar + flag 필요 |
| Spring Boot Starter | application.yml 통합 | Spring 외 라이브러리 한계 |
| Manual SDK | 정밀 제어 | 라이브러리마다 작성 필요 |

권장: **Spring Boot Starter + Manual 보강 attribute**. msa 는 16개 모두 Spring Boot 라 Starter 가 적합.

### 13-4. Phase plan

```
Phase 1 (1주): Tempo + OTel Collector(gateway 1대) 인프라 도입
                 helm install grafana/tempo + grafana/opentelemetry-collector
Phase 2 (1주): 16 service 에 spring-boot-starter 추가 + application.yml 표준
                 endpoint=http://otel-collector:4318
                 tracing.sampling.probability=0.1
Phase 3 (1주): Grafana datasource (Tempo) + 기본 Service Graph dashboard
                 percentiles-histogram=true (ADR-0025) + exemplar 활성
                 Prometheus exemplar-storage flag
Phase 4 (2주): Loki + logback-spring.xml + OTel logback appender
                 MDC 의 trace_id / span_id 가 자동
                 Grafana log → trace 점프
Phase 5 (1주): tail_sampling (errors + slow + 1% random) Collector 단계
                 head sampling 100% → 10%
Phase 6 (1주): semantic conventions 검증 + commerce.* attribute 표준화
Phase 7 (지속): SLO / Burn rate alert 작성 (recording rule + alerting rule)
```

### 13-5. 즉시 시작 PR (작은 단위)

```yaml
# k8s/infra/prod/observability/otel-collector-values.yaml (신규)
mode: deployment
replicaCount: 2

config:
  receivers:
    otlp:
      protocols:
        grpc: { endpoint: 0.0.0.0:4317 }
        http: { endpoint: 0.0.0.0:4318 }
  processors:
    memory_limiter:
      check_interval: 1s
      limit_mib: 1024
    batch:
      send_batch_size: 1024
      timeout: 10s
    attributes:
      actions:
        - key: deployment.environment
          value: prod
          action: insert
  exporters:
    otlp/tempo:
      endpoint: tempo.observability.svc:4317
      tls: { insecure: true }
    prometheusremotewrite:
      endpoint: http://kube-prometheus-stack-prometheus.monitoring.svc:9090/api/v1/write
    loki:
      endpoint: http://loki.observability.svc:3100/loki/api/v1/push
  service:
    pipelines:
      traces:
        receivers: [otlp]
        processors: [memory_limiter, attributes, batch]
        exporters: [otlp/tempo]
      metrics:
        receivers: [otlp]
        processors: [memory_limiter, batch]
        exporters: [prometheusremotewrite]
      logs:
        receivers: [otlp]
        processors: [memory_limiter, attributes, batch]
        exporters: [loki]

resources:
  requests: { cpu: 200m, memory: 512Mi }
  limits:   { memory: 1Gi }
```

```kotlin
// {service}/app/build.gradle.kts (각 서비스에 1줄)
implementation("io.opentelemetry.instrumentation:opentelemetry-spring-boot-starter:2.x.x")
```

```yaml
# {service}/app/src/main/resources/application.yml (16개 서비스 공통 추가)
management:
  tracing:
    sampling:
      probability: 0.1
  otlp:
    tracing:
      endpoint: http://otel-collector.observability.svc:4318/v1/traces
    metrics:
      export:
        url: http://otel-collector.observability.svc:4318/v1/metrics
    logging:
      endpoint: http://otel-collector.observability.svc:4318/v1/logs
```

### 13-6. 도메인 attribute 표준 (commerce.*)

```kotlin
object CommerceAttrs {
    val TENANT_ID = AttributeKey.stringKey("commerce.tenant.id")
    val ORDER_ID = AttributeKey.stringKey("commerce.order.id")
    val ORDER_STATUS = AttributeKey.stringKey("commerce.order.status")
    val PRODUCT_SKU = AttributeKey.stringKey("commerce.product.sku")
    // userId 는 high-cardinality 라 라벨에는 ❌, span attribute 만 OK
    val USER_ID = AttributeKey.stringKey("commerce.user.id")
}

// 사용
span.setAttribute(CommerceAttrs.ORDER_ID, order.id)
span.setAttribute(CommerceAttrs.ORDER_STATUS, order.status.name)
```

→ ADR 후보로 commerce.* 네임스페이스 추가.

---

## 14. ADR 후보

> **ADR-XXXX-B: OpenTelemetry 도입 — Tempo / Loki / 기존 Prometheus 통합 + commerce.* attribute 표준화**
>
> **Context**: msa 의 trace 인프라 0, log 수집 0, MDC 0 (#12). vendor lock-in 회피 + 3-pillar 통합 + W3C 표준 + Grafana 스택 통일이 도입 동기. 현재 Spring Boot Actuator + Micrometer 가 16개 모두 도입되어 있어 OTel Spring Boot Starter 추가의 비용은 라이브러리 1줄 + application.yml 수정 수준.
>
> **Decision**:
> - **SDK**: 16 서비스에 OpenTelemetry Spring Boot Starter (Micrometer Tracing 포함).
> - **Propagation**: W3C Trace Context (B3 호환은 외부 통합 시 추가).
> - **Backend**: Grafana Tempo (traces) + 기존 Prometheus + Loki (logs). Grafana 스택 통일.
> - **Collector**: Deployment 2 replica (gateway 모드). OTLP gRPC 4317 + HTTP 4318 receiver. tail_sampling (Phase 5).
> - **Sampling**: head 100% (Phase 1) → parentBased(traceIdRatioBased(0.1)) + tail (errors / slow / 1% random) (Phase 5).
> - **Semantic conventions**: 표준 키 우선. 도메인 attribute 는 `commerce.*` 네임스페이스로 표준화.
> - **Exemplar**: Prometheus `--enable-feature=exemplar-storage` 활성. Spring `percentiles-histogram=true`.
> - **MDC + Logback**: OTel Logback appender 로 trace_id / span_id 자동 inject. Loki 송신.
>
> **Consequences**:
> - (+) ADR-0025 의 metric→trace→log 점프 closed loop 동작.
> - (+) vendor lock-in 회피, backend 변경 시 Collector 만 수정.
> - (+) 16 서비스 cross-service trace 자동 연결 (W3C 표준).
> - (-) Collector 운영 부담 추가 (CPU 200m × 2, RAM 1Gi × 2).
> - (-) tail_sampling 도입 시 Collector RAM 4~8Gi 증가.
> - (-) Tempo / Loki 인프라 도입 비용 (S3 backend 권장 시 + S3 비용).
>
> **Alternatives 검토**:
> - Datadog / New Relic 같은 SaaS — 기능 우수하나 vendor lock-in + 비용. 채택 ❌.
> - Jaeger 단독 + ELK 단독 — 3-pillar 통합 부재, propagation 표준 다름. 채택 ❌.
> - Spring Cloud Sleuth — Spring Boot 3.x 부터 Micrometer Tracing 으로 흡수, 본질적으로 OTel bridge. 직접 OTel 이 깔끔.

---

## 15. 면접 한 줄 답변

### Q. OpenTelemetry 가 단순한 Tracing 라이브러리가 아니라는 의미는?

> "OTel 은 traces / metrics / logs 의 3-pillar 를 같은 trace_id, span_id, Resource attribute 로 묶는 통합 컨텍스트 모델 + 같은 wire protocol (OTLP) + 같은 의미 표준 (Semantic Conventions) 의 표준 패키지입니다. 단순 라이브러리가 아니라 vendor-neutral 표준이라 코드는 OTel API 만 의존하고 backend (Jaeger / Tempo / Datadog) 는 자유 선택할 수 있다는 게 핵심입니다."

### Q. Resource attribute 와 Span attribute 의 차이는?

> "Resource 는 '이 시그널을 누가 만들었는가' (process identity) 로 service.name / k8s.pod.name 같이 process 시작 시 1회 결정되어 모든 시그널에 공통으로 따라붙습니다. Span Attribute 는 '이 시그널이 무엇에 대해 말하는가' (event 컨텍스트) 로 http.method / db.statement 같이 span 마다 다릅니다. Prometheus 라벨로 환산하면 Resource 는 외부 라벨 (target/job), Attribute 는 metric 라벨에 해당하고, 둘을 구분 못하면 cardinality 가 폭발합니다."

### Q. W3C Trace Context 의 traceparent 헤더 구조는?

> "`version-traceId-parentId-flags` 형식입니다. version 1byte, traceId 16byte, parentId 8byte (parent span_id), flags 1byte 의 hex 인코딩입니다. flags 의 bit 0 가 sampled 여부를 나타냅니다. tracestate 는 vendor-specific 메타, baggage 는 application 정의 key/value 의 cross-service 전파에 별도 헤더로 분리됩니다."

### Q. Baggage 와 Span Attribute 의 차이는?

> "Baggage 는 cross-service 로 전파되는 application 정의 컨텍스트 (예: tenantId, A/B 그룹) 입니다. wire 로 흐르므로 민감정보 금지입니다. Span Attribute 는 한 span 안에서만 의미가 있고 자동으로 다음 service 로 안 갑니다. Baggage 를 모든 downstream span 의 attribute 로 자동 추가하지 않는 이유는 cardinality 폭증 방어와 의도성 보장입니다."

### Q. SpanKind 5종은 왜 구분합니까?

> "SERVER / CLIENT / PRODUCER / CONSUMER / INTERNAL — backend (Jaeger / Tempo) 가 trace 시각화 시 어느 쪽이 incoming / outgoing 인지 결정하는 데 씁니다. 특히 PRODUCER / CONSUMER 는 시간차가 커서 부모-자식이 아니라 link 로 연결되는 게 표준 패턴이고, 서비스 맵 자동 생성도 SpanKind 기반입니다. INTERNAL 은 한 process 내부 함수 호출용으로 도메인 attribute 풍부하게 다는 데 적합합니다."

### Q. OTel Collector 가 application 직접 export 보다 좋은 이유는?

> "여섯 가지입니다. (1) 한 데이터를 여러 backend 로 fan-out, (2) app 재시작 시 buffer / retry, (3) PII 마스킹 / cardinality 정리 등 transform, (4) tail_sampling 같이 app 단계에서 불가능한 후처리, (5) multi-tenant routing, (6) backend 갈아탈 때 app 재배포 안 하고 Collector 만 수정. 운영 패턴은 보통 Agent (DaemonSet) + Gateway (Deployment) 의 2-tier 입니다."

### Q. Head sampling 과 tail sampling 의 차이는?

> "Head 는 root span 생성 시점 (SDK 단계) 에서 trace_id hash 로 결정 — 같은 trace 의 모든 span 이 일관된 결정을 따르고 cluster wide 로 분산 일관됩니다. Tail 은 Collector 가 모든 span 을 buffer 한 후 (보통 10s decision_wait) 결정 — 에러 / 500ms 이상 / 1% 랜덤을 결합해 가치 있는 trace 100% 보존하고 나머지 drop 합니다. Tail 은 Collector RAM / CPU 비용이 크지만 운영 trace 품질이 head 만으로는 못 만드는 수준입니다."

### Q. Exemplar 는 무엇이고 왜 중요합니까?

> "Histogram bucket 의 한 sample 에 첨부된 trace_id sample 1개입니다. Prometheus 가 exemplar-storage 활성 시 저장하고, Grafana 의 metric panel 에서 ◆ 점을 클릭하면 그 시간대 trace 1건으로 점프합니다. ADR-0025 가 강제하는 metric→trace 점프의 실제 동작 매개체입니다. 동작에는 (1) percentiles-histogram=true, (2) Prometheus exemplar-storage flag, (3) OTel SDK 의 trace 발생, (4) Grafana datasource 의 exemplar 옵션, 4가지 모두 필요합니다."

### Q. Semantic Conventions 가 왜 중요합니까?

> "같은 attribute 키 (`http.method` / `http.status_code` / `db.system` ...) 를 모든 라이브러리, 모든 언어, 모든 vendor 가 공유하면 Grafana 대시보드 / alert query / backend tooling (Jaeger service map, Tempo span query) 이 cross-service 로 portable 해집니다. 비표준 키 (`kafka.topic` 같은) 를 쓰면 그 query 가 다른 서비스에서 안 통하고, 도메인 attribute 는 `commerce.*` 같은 별도 네임스페이스로 분리하는 게 표준입니다."

### Q. OTLP 의 gRPC 와 HTTP 중 무엇을 씁니까?

> "cluster 내부는 gRPC (4317) 가 default — HTTP/2 streaming 으로 효율적입니다. 외부 SaaS backend 통과나 방화벽 / 인증 게이트웨이가 필요하면 HTTP/protobuf (4318) 를 씁니다. gzip / zstd 압축으로 50~70% 절감 + sending_queue + retry 로 backend 일시 장애 5분까지 흡수하는 게 운영 표준입니다."

### Q. msa 에 OTel 을 어떻게 도입할 계획입니까?

> "16 서비스 모두 Spring Boot 라 OpenTelemetry Spring Boot Starter 한 줄 추가가 출발입니다. backend 는 Grafana Tempo + Loki + 기존 Prometheus 로 Grafana 스택 통일, Collector 는 Deployment 2 replica 의 gateway 모드. Phase 1 은 head 100% sampling + Tempo 만 도입, Phase 5 에서 tail_sampling (errors / slow / 1% random) 으로 비용 최적화. 도메인 attribute 는 `commerce.*` 네임스페이스로 표준화하는 ADR 후보가 별도로 있습니다."

---

## 16. 흔한 오해 정정

> **"OTel 은 Tracing 라이브러리다"**

- ❌ Traces / Metrics / Logs 3-pillar 의 통합 표준. 라이브러리는 그 일부.

> **"OTel SDK 만 깔면 모든 시그널이 자동 발생한다"**

- ⚠ Auto instrumentation (Java agent / Spring Boot Starter) 이 70+ 라이브러리 자동 처리하지만, 도메인 attribute 와 비표준 라이브러리는 manual 필요.

> **"trace_id 만 있으면 cross-service trace 가 자동으로 이어진다"**

- ❌ propagator 가 traceparent 헤더를 inject / extract 해야 동작. propagator 가 없거나 라이브러리가 자동 inject 안 하면 trace 단절.

> **"Baggage 는 자동으로 모든 span 의 attribute 가 된다"**

- ❌ baggage 는 wire 전파만, attribute 로 옮기려면 명시. 자동 추가는 cardinality 폭발 위험으로 의도적 분리.

> **"Collector 가 없으면 OTel 을 못 쓴다"**

- ❌ application 이 backend 에 직접 OTLP export 가능. 단 운영 fan-out / retry / transform 이 어려워 권장 아님.

> **"head sampling 100% 가 가장 안전하다"**

- ⚠ 안전하지만 Tempo / Loki 비용 폭발. 운영은 head 10% + tail (errors + slow + 랜덤) 결합이 표준.

> **"OpenTelemetry 와 Prometheus 는 둘 중 하나만 쓴다"**

- ❌ 공존이 표준. Spring Boot Actuator 가 Prometheus expose + OTLP export 동시. exemplar 가 둘을 잇는 다리.

> **"Semantic Conventions 는 권고 수준"**

- ⚠ 권고지만 안 따르면 Grafana 대시보드 / Jaeger 의 서비스 맵 / SQL-like trace query 가 portable 하지 않음. 사실상 강제.

> **"Java agent 가 Spring Boot Starter 보다 항상 좋다"**

- ⚠ 라이브러리 커버리지는 agent 가 넓지만 Spring Boot Starter 는 application.yml 통합 / 운영 단순. msa 처럼 Spring Boot 일색이면 Starter 가 적합.

> **"OTLP 가 gRPC only 다"**

- ❌ HTTP/protobuf (4318) 도 표준. 외부 SaaS backend 는 HTTP 가 주류.

---

## 17. 회독 체크리스트

> §16 회독 체크리스트:
> - [ ] OTel 이 3-pillar (traces/metrics/logs) 의 통합 표준이라는 의미와 closed loop (metric→trace→log)
> - [ ] Resource (process identity) vs Span Attribute (event 컨텍스트) 의 분리 + cardinality 시사
> - [ ] TracerProvider / MeterProvider / LoggerProvider 의 6개 컴포넌트 (Sampler / SpanProcessor / Exporter / View / Resource / propagator)
> - [ ] BatchSpanProcessor 의 maxQueueSize / scheduledDelay / drop 메트릭
> - [ ] Java agent / Spring Boot Starter / Manual 의 3가지 instrumentation 방식 + msa 선택
> - [ ] SpanKind 5종 (SERVER/CLIENT/PRODUCER/CONSUMER/INTERNAL) + PRODUCER↔CONSUMER 가 link 인 이유
> - [ ] W3C Trace Context 의 traceparent 헤더 구조 (version/traceId/parentId/flags)
> - [ ] tracestate (vendor) vs baggage (application context) 의 분리
> - [ ] B3 propagator 와의 공존 (composite propagator)
> - [ ] Collector 의 3-stage pipeline (Receiver / Processor / Exporter) + traces/metrics/logs 별 분리
> - [ ] memory_limiter / batch / attributes / resource / tail_sampling / transform 의 역할
> - [ ] tail_sampling policy 6종 (status_code / latency / probabilistic / rate_limiting / string_attribute / composite)
> - [ ] agent (DaemonSet) vs gateway (Deployment) 2-tier 패턴
> - [ ] head sampling 의 parentBased(traceIdRatioBased) 표준 + tail sampling 보완 관계
> - [ ] exemplar 동작 4 조건 (percentiles-histogram / exemplar-storage / OTel SDK / Grafana datasource)
> - [ ] Semantic Conventions 표준 키 (http/db/messaging/k8s/service) + commerce.* 도메인 분리
> - [ ] OTLP gRPC (4317) vs HTTP (4318) + 압축 + sending_queue + retry
> - [ ] OTel vs Prometheus / Jaeger / Zipkin / Sleuth 의 비교 + 마이그레이션 경로
> - [ ] msa 도입 7 phase (인프라 → SDK → exemplar → 로그 → tail sampling → semantic conv → SLO)

---

## 18. 연결 학습

- §08 OpenTelemetry tracing 기초 — 본 글의 layer 위 (입문) — Trace/Span/SpanKind 의 기본 개념
- §09 sampling and correlation — head/tail 의 더 깊은 수치 분석 + log↔trace 연결
- §12 msa 현 상태 — 본 글 §13 의 Phase plan 의 출발점 (인프라 0)
- §15 Prometheus internals — exemplar 의 Prometheus 측 짝꿍 (TSDB 의 exemplar storage)
- ADR-0025 latency budget — metric→trace 점프 강제 (본 글 §9 exemplar 가 그 매개)
- (예정) §17 SLO / Burn rate alerting — recording rule + multi-window alert 의 실전 (OTel metrics 를 source 로)
- (예정) §11 eBPF profiling — 4번째 pillar (continuous profiling) — trace 와 같은 trace_id 로 연결되는 미래 표준
