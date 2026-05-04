---
parent: 10-observability
phase: 2
title: 구조화 로그 + MDC + Trace ID 전파 + Webflux 함정
created: 2026-05-01
---

# 07. 구조화 로그 / MDC / Trace ID 전파 / 비동기 컨텍스트

## 1. 구조화 vs 비구조화 — 1번 의사결정

```
# ❌ 비구조화 (기본 Spring Boot 출력)
2026-05-01 10:23:45.123 INFO  c.k.p.ProductService - Product created: id=42 user=alice

# ✅ 구조화 (JSON 한 줄)
{"ts":"2026-05-01T10:23:45.123Z","level":"INFO","logger":"c.k.p.ProductService","service":"product","trace_id":"3a72fd1a","span_id":"b3f9","msg":"Product created","product_id":42,"user_id":"alice"}
```

### 1.1 구조화 로그가 항상 답인 이유

| 측면 | 비구조화 | 구조화 (JSON) |
|---|---|---|
| Loki / ES 파싱 | grok 정규식 매번 작성 | 자동 |
| 필드 검색 | 텍스트 grep | `\| json \| user_id="alice"` |
| 분석 / 집계 | 어려움 | aggregation 1줄 |
| 신규 필드 추가 | grok 패턴 변경 | 그냥 필드 추가 |
| 가독성 (사람) | ✅ 좋음 | ❌ 나쁨 |

→ 가독성 손실은 **Grafana / Kibana UI 가 prettify 해주므로** 무시 가능. 구조화가 정답.

### 1.2 형식 후보

| 형식 | 장점 | 단점 |
|---|---|---|
| **JSON** | 표준, 모든 도구 지원 | 사람이 raw 로 읽기 힘듦 |
| logfmt (`key=value`) | 간단, 텍스트 친화 | 중첩 어려움 |
| Common Log Format | nginx 호환 | 필드 한정 |

→ JSON 1순위. logfmt 는 Loki + simple service 에서 검토.

## 2. MDC — Mapped Diagnostic Context

### 2.1 MDC 가 무엇인가

SLF4J 가 제공하는 **ThreadLocal 기반 K/V store**. 같은 요청 처리 중 어디서든 `MDC.put("trace_id", "abc")` 하면 그 thread 의 모든 로그에 자동으로 trace_id 가 붙음.

```kotlin
// HandlerInterceptor 또는 Filter
override fun preHandle(req: HttpServletRequest, res: HttpServletResponse, handler: Any): Boolean {
    val traceId = req.getHeader("X-Trace-Id") ?: UUID.randomUUID().toString().substring(0, 8)
    MDC.put("trace_id", traceId)
    MDC.put("user_id", extractUserId(req))
    return true
}

override fun afterCompletion(...) {
    MDC.clear()  // 필수! 안 지우면 thread pool 의 다음 요청에 누수
}
```

### 2.2 MDC 가 logback pattern 에 반영되는 법

```xml
<pattern>%d{ISO8601} %-5level [%X{trace_id:-}] [%X{user_id:-}] %logger - %msg%n</pattern>
```

→ `%X{trace_id}` 가 MDC 의 trace_id 키. 없으면 빈 문자열.

JSON 로그에서는 (이전 #06 의 logback-spring.xml 참조):
```
"trace_id": "%mdc{trace_id:-}"
```

### 2.3 MDC 의 함정 — Thread Pool / Async

ThreadLocal 기반이라 **다른 thread 로 옮겨가면 사라진다**.

```kotlin
// ❌ 문제 — @Async 호출 시 MDC 손실
@Async
fun publishEvent(event: Event) {
    log.info { "Publishing: ${event.id}" }   // trace_id 없음
}

// ✅ 해결 1: TaskDecorator
@Configuration
class MdcConfig {
    @Bean
    fun taskExecutor(): TaskExecutor {
        return ThreadPoolTaskExecutor().apply {
            setTaskDecorator(MdcTaskDecorator())
        }
    }
}

class MdcTaskDecorator : TaskDecorator {
    override fun decorate(runnable: Runnable): Runnable {
        val context = MDC.getCopyOfContextMap() ?: emptyMap()
        return Runnable {
            MDC.setContextMap(context)
            try {
                runnable.run()
            } finally {
                MDC.clear()
            }
        }
    }
}
```

### 2.4 Coroutine 의 MDC — `MDCContext`

Kotlin coroutines 는 ThreadLocal 을 자동 전파하지 않음. `kotlinx-coroutines-slf4j` 의 `MDCContext` 필요.

```kotlin
import kotlinx.coroutines.slf4j.MDCContext

suspend fun handleRequest(): Response {
    return withContext(Dispatchers.IO + MDCContext()) {
        log.info { "Handling..." }   // trace_id 정상 전파
        repository.find()
    }
}
```

→ msa 는 ADR (Architecture Decision Record, 아키텍처 결정 기록)-0002 에서 "Coroutine 외부 IO" 사용 — MDCContext 적용이 필수. (Phase 3 검증 항목)

## 3. Webflux — MDC 가 깨진다

Reactor Flux/Mono 는 **여러 thread 를 옮겨다닌다**. ThreadLocal 기반 MDC 는 동작하지 않음.

### 3.1 해결책 — Reactor Context

```kotlin
// Webflux 환경의 MDC 전파
fun <T> Mono<T>.withMdc(): Mono<T> = this.contextWrite { ctx ->
    Context.of("trace_id", MDC.get("trace_id") ?: "")
}.doOnEach { signal ->
    signal.contextView.getOrEmpty<String>("trace_id")
        .ifPresent { MDC.put("trace_id", it) }
}
```

→ msa 의 gateway (Spring Cloud Gateway = Webflux) 에 적용 필요.

### 3.2 Spring Boot 3.2+ 의 Micrometer Context Propagation

`io.micrometer:context-propagation` 라이브러리가 ThreadLocal ↔ Reactor Context 자동 전파 → 위 boilerplate 불필요.

```kotlin
// auto-configured in Spring Boot 3.2+
ContextRegistry.getInstance().registerThreadLocalAccessor(
    "trace_id",
    { MDC.get("trace_id") },
    { value -> MDC.put("trace_id", value) },
    { MDC.remove("trace_id") }
)
```

## 4. Trace ID 의 출처 — 3가지 옵션

### 4.1 옵션 A: Custom Header (`X-Trace-Id`)

- 가장 단순. msa 에 적용 가능.
- **표준이 아님** → 외부 ↔ 내부 호환 안됨 (예: Datadog APM 과 연동 안됨)

### 4.2 옵션 B: W3C Trace Context — `traceparent`

```
traceparent: 00-{trace_id}-{span_id}-{flags}
            예: 00-3a72fd1a8b62cd1f9c-b3f99c1a4-01
```

- W3C 표준. OpenTelemetry / Jaeger / Zipkin / Datadog 모두 지원.
- **trace_id**: 32 hex (16 byte)
- **span_id**: 16 hex (8 byte)
- **flags**: 01 = sampled

→ msa 의 trace 도입 시 정답.

### 4.3 옵션 C: B3 Headers (Zipkin legacy)

```
X-B3-TraceId: 3a72fd1a8b62cd1f9c
X-B3-SpanId: b3f99c1a4
X-B3-Sampled: 1
```

- Zipkin 시절 표준. 호환성 위해 일부 서비스 mesh 에서 여전히 지원.
- 새 시스템은 W3C traceparent 권장.

## 5. Service 간 전파 — Filter / Interceptor 패턴

### 5.1 receiving (incoming)

```kotlin
@Component
class TraceIdFilter : OncePerRequestFilter() {
    override fun doFilterInternal(req: HttpServletRequest, res: HttpServletResponse, chain: FilterChain) {
        val traceParent = req.getHeader("traceparent")
        val (traceId, spanId) = parseTraceParent(traceParent)
            ?: (UUID.randomUUID().toString().replace("-", "").take(32) to randomSpanId())

        try {
            MDC.put("trace_id", traceId)
            MDC.put("span_id", spanId)
            res.setHeader("trace-id", traceId)   // 응답에도 echo
            chain.doFilter(req, res)
        } finally {
            MDC.clear()
        }
    }
}
```

### 5.2 emitting (outgoing) — WebClient / RestTemplate

```kotlin
// WebClient 에 traceparent 자동 추가
@Bean
fun webClientBuilder(): WebClient.Builder = WebClient.builder()
    .filter { request, next ->
        val traceId = MDC.get("trace_id")
        val spanId = MDC.get("span_id")
        if (traceId != null) {
            val newSpanId = randomSpanId()
            val mutated = ClientRequest.from(request)
                .header("traceparent", "00-$traceId-$newSpanId-01")
                .build()
            // 자식 span_id 를 다시 MDC 에 옮길 수도 있음 (선택)
            next.exchange(mutated)
        } else {
            next.exchange(request)
        }
    }
```

→ **OpenTelemetry SDK 가 이 모든 것을 자동화** (#08 에서). 단, 도입 전에는 위 boilerplate 가 정답.

### 5.3 Kafka 전파 — Header 사용

```kotlin
// 발행
fun publish(topic: String, payload: ByteArray) {
    val record = ProducerRecord(topic, null, payload)
    record.headers().add("traceparent", buildTraceParent().toByteArray())
    producer.send(record)
}

// 소비
@KafkaListener(...)
fun consume(record: ConsumerRecord<String, ByteArray>) {
    val traceParent = record.headers().lastHeader("traceparent")?.value()?.let(::String)
    val (traceId, _) = parseTraceParent(traceParent) ?: (newTraceId() to newSpanId())
    MDC.put("trace_id", traceId)
    try {
        // process
    } finally {
        MDC.clear()
    }
}
```

→ 비동기 경계 (Kafka) 에서도 trace_id 가 이어진다 — 분산 trace 의 핵심.

## 6. PII 마스킹 (#06 보완)

### 6.1 처음부터 안 적기 — 코드 컨벤션

`docs/conventions/logging.md` (실제 인용):
> 로그 메시지에 민감 정보 (비밀번호, 토큰, 개인정보 등) 포함 금지

- 이메일은 hash 또는 prefix only (`a***@example.com`)
- userId 는 internal ID (UUID) 만, 이름/전화번호 금지
- request body / response body 통째로 dump 금지 (#13 cross-ref JWT 의 plaintext)

### 6.2 자동 마스킹 — Logback Converter

```kotlin
class MaskingMessageConverter : MessageConverter() {
    private val patterns = listOf(
        Regex("\\b\\d{4}-\\d{4}-\\d{4}-\\d{4}\\b") to "****-****-****-****",   // 카드
        Regex("\\b\\d{6}-\\d{7}\\b") to "******-*******",                      // 주민번호
        Regex("\\b[A-Za-z0-9._]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b") to "***@***",
        Regex("\"password\"\\s*:\\s*\"[^\"]*\"") to "\"password\":\"***\"",
        Regex("Authorization: Bearer [A-Za-z0-9._-]+") to "Authorization: Bearer ***"
    )

    override fun convert(event: ILoggingEvent): String {
        var msg = event.formattedMessage
        patterns.forEach { (regex, replacement) ->
            msg = msg.replace(regex, replacement)
        }
        return msg
    }
}
```

→ Logback `<conversionRule conversionWord="m" converterClass="...">` 로 등록.

### 6.3 검증 — Test 로 강제

```kotlin
class LogMaskingSpec : BehaviorSpec({
    Given("로그에 카드번호 포함") {
        val msg = "Payment with card 1234-5678-9012-3456 succeeded"
        When("MaskingConverter 적용") {
            val masked = MaskingMessageConverter().mask(msg)
            Then("카드번호가 마스킹됨") {
                masked shouldContain "****-****-****-****"
                masked shouldNotContain "1234-5678"
            }
        }
    }
})
```

## 7. 로그 vs 메트릭 — 어느 쪽으로 보낼지

같은 정보를 메트릭과 로그 둘 다에 보내면 비용 낭비. 룰:

| 정보 | 추천 |
|---|---|
| 카운트 / 비율 / 분포 | **메트릭** (rate, histogram_quantile) |
| 이벤트 컨텍스트 (어떤 user 가 어떤 product 에) | 로그 |
| 디버깅용 raw 데이터 | 로그 |
| trace 시각화 | trace |
| 시계열 trend | 메트릭 |

→ "ERROR 발생 횟수" 는 **둘 다**: 메트릭으로 rate 추적, 로그로 detail 보관. 단, 로그를 metric 처럼 집계하려고 하면 (Loki `count_over_time`) 비용 폭증 가능 — 메트릭이 정답.

## 8. msa 의 로그 현황 (Phase 3 미리보기)

- ✅ kotlin-logging 표준 (`docs/conventions/logging.md`)
- ✅ 람다 형식 강제 (`log.info { "..." }`)
- ✅ PII 룰 명시
- ❌ logback-spring.xml 미작성 (find 결과 0개)
- ❌ JSON 출력 (Spring 기본 = text)
- ❌ MDC trace_id 전파 — 미적용 (grep 결과 없음)
- ❌ Webflux Reactor Context 전파 (gateway)
- ❌ Coroutine MDCContext (quant, ADR-0002 영향)
- ❌ Kafka header 기반 trace_id 전파

→ #13 ADR 후보 중 가장 높은 ROI: **logback-spring.xml + TraceIdFilter + MDCContext** 일괄 패키지.

## 9. 운영 체크리스트

- [ ] logback-spring.xml `common/` 모듈 표준화
- [ ] TraceIdFilter (Servlet) — gateway 외 14개 서비스
- [ ] WebFluxTraceIdFilter — gateway
- [ ] WebClient builder 에 traceparent 헤더 자동 주입 (`CommonWebClientAutoConfiguration` 확장)
- [ ] Kafka producer interceptor — header 자동 주입
- [ ] Kafka consumer aspect — header → MDC 자동 주입
- [ ] Coroutine MDCContext 가이드 문서
- [ ] Logback masking converter
- [ ] PII 단위 테스트 (BehaviorSpec)

## 10. 핵심 정리

- **JSON 구조화 로그가 정답** — Loki/ES 양쪽 모두 자동 파싱
- MDC 는 ThreadLocal — Async / Coroutine / Webflux 에서 깨짐 → TaskDecorator / MDCContext / Reactor Context
- Trace ID 는 **W3C `traceparent`** 표준 (OTel / Jaeger / Datadog 호환)
- Filter/Interceptor 로 incoming + WebClient filter 로 outgoing + Kafka header 로 비동기
- PII 마스킹은 **코드 컨벤션 + Logback Converter** 2단 방어
- 로그 vs 메트릭: 카운트 = 메트릭, 컨텍스트 = 로그
- msa 는 logback-spring.xml + MDC 전파 미적용 — 도입 ROI 매우 큼

## 11. 다음 단계

- [08-opentelemetry-tracing.md](08-opentelemetry-tracing.md) — OpenTelemetry SDK / Collector / W3C / Java Agent
