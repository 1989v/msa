---
parent: 18-grpc
seq: 09
title: 고급 기능 — Deadline · Cancellation · Interceptor · Metadata · Retry
type: deep
created: 2026-05-01
---

# 09. 고급 기능

## 1. Deadline propagation — REST 에는 없는 핵심 가치

gRPC RPC 마다 **deadline (절대 시각 timeout)** 을 부여하면 모든 downstream 호출에 자동 전파된다.

### 1-1. 기본 사용

```kotlin
// 클라이언트 — deadline 500ms
val resp = stub.withDeadlineAfter(500, TimeUnit.MILLISECONDS)
    .getProduct(req)
```

내부 동작:
1. 클라가 `grpc-timeout: 500m` metadata 헤더 송신
2. 서버 측 stub 이 자동으로 deadline 인지
3. 서버가 다른 gRPC 를 호출하면 **남은 시간**으로 deadline 전파
4. 어떤 hop 에서든 deadline 만료 → 즉시 cancel 신호 전파 → 모든 hop 의 자원 회수

### 1-2. 전파 예

```
Client (deadline 500ms)
  → gateway (남은 480ms)
    → auth (남은 460ms)
    → order (남은 450ms)
      → inventory (남은 430ms)
      → payment (남은 420ms)
```

각 hop 이 처리 시간을 소모할수록 남은 deadline 이 짧아지고, 만료가 임박하면 **서비스가 사전에 거부** 가능 (`if (Context.current().deadline?.isExpired) ...`).

### 1-3. REST 의 timeout 과 비교

| 항목 | REST 의 timeout | gRPC deadline |
|---|---|---|
| 전파 | 수동 (custom header) | 자동 |
| 단위 | 보통 connect/read 별도 | 절대 시각 |
| 의미 | 호출자만 인지 | downstream 모두 인지 |
| 취소 신호 | 클라 close → TCP RST | RST_STREAM 즉시 |
| 표준 | 없음 | `grpc-timeout` metadata 표준 |

⇒ msa 의 **fan-out 핫패스에서 tail latency 곱셈 효과 방지** 의 강력한 도구. ADR-0025 (latency budget) 와 자연스럽게 결합.

### 1-4. 실무 권고

- 모든 RPC 는 deadline 을 **반드시 명시** (default = 무한 대기 = 위험)
- gateway / outermost hop 이 사용자 SLA 에서 derive (예: 3s)
- 내부 호출은 자동 전파 → 별도 설정 불필요
- deadline 이 임박하면 **expensive work 를 시작하지 말 것** (DB 쓰기, 외부 호출)

## 2. Cancellation propagation

### 2-1. 메커니즘

- 클라가 stream cancel → HTTP/2 `RST_STREAM` frame 송신
- 서버 측 `Context.current().isCancelled` = true
- 서버가 호출하던 downstream 도 자동 cancel
- coroutine stub 의 경우 `CancellationException` 으로 자연스럽게 throw

### 2-2. 코드 예

```kotlin
override suspend fun getProduct(request: GetProductRequest): GetProductResponse {
    // 시간 오래 걸리는 작업 중 cancel 체크
    val product = withContext(Dispatchers.IO) {
        productRepository.findByIdWithEnrichment(request.id) {
            // checkpoint 마다 cancel 체크
            if (currentCoroutineContext().isActive.not()) {
                throw CancellationException()
            }
        }
    }
    return getProductResponse { this.product = product.toProto() }
}
```

### 2-3. 이득

- 클라가 화면을 떠나면 서버 측 작업도 즉시 중단 → CPU/DB 자원 회수
- streaming RPC 에서 특히 중요 (long-lived stream 의 graceful close)

## 3. Interceptor — cross-cutting concerns

REST 의 Filter / Spring 의 HandlerInterceptor 와 같은 역할.

### 3-1. ClientInterceptor

```kotlin
class AuthInterceptor(private val tokenProvider: TokenProvider) : ClientInterceptor {
    override fun <ReqT, RespT> interceptCall(
        method: MethodDescriptor<ReqT, RespT>,
        callOptions: CallOptions,
        next: Channel,
    ): ClientCall<ReqT, RespT> {
        return object : ForwardingClientCall.SimpleForwardingClientCall<ReqT, RespT>(
            next.newCall(method, callOptions)
        ) {
            override fun start(responseListener: Listener<RespT>, headers: Metadata) {
                headers.put(Metadata.Key.of("authorization", Metadata.ASCII_STRING_MARSHALLER),
                    "Bearer ${tokenProvider.get()}")
                super.start(responseListener, headers)
            }
        }
    }
}

val channel = ManagedChannelBuilder.forAddress("auth", 9090)
    .intercept(AuthInterceptor(tokenProvider))
    .intercept(LoggingClientInterceptor())
    .build()
```

### 3-2. ServerInterceptor

```kotlin
class JwtServerInterceptor : ServerInterceptor {
    override fun <ReqT, RespT> interceptCall(
        call: ServerCall<ReqT, RespT>,
        headers: Metadata,
        next: ServerCallHandler<ReqT, RespT>,
    ): ServerCall.Listener<ReqT> {
        val token = headers.get(Metadata.Key.of("authorization", Metadata.ASCII_STRING_MARSHALLER))
            ?.removePrefix("Bearer ")
            ?: run {
                call.close(Status.UNAUTHENTICATED.withDescription("missing token"), Metadata())
                return object : ServerCall.Listener<ReqT>() {}
            }

        val claims = jwtValidator.validate(token)
        val ctx = Context.current().withValue(USER_ID_KEY, claims.subject)
        return Contexts.interceptCall(ctx, call, headers, next)
    }
}
```

### 3-3. 흔한 사용처

| Interceptor | 역할 |
|---|---|
| AuthClientInterceptor | JWT / API key 자동 주입 |
| LoggingInterceptor | 모든 RPC 로깅 |
| MetricsInterceptor | latency / error rate 메트릭 (Micrometer 통합) |
| TracingInterceptor | OpenTelemetry trace context 전파 |
| RetryInterceptor | gRPC 자체 retry 로 충분, 별도 작성은 신중히 |
| RateLimitInterceptor | 서버 측 admission control |

## 4. Metadata — gRPC 의 헤더

### 4-1. 기본

- key-value 쌍 (HTTP/2 의 HPACK 헤더와 trailers 위에 매핑)
- `Metadata.Key<String>` / `Metadata.Key<ByteArray>` (binary는 `-bin` suffix)
- ASCII key: 소문자, 영문/숫자/하이픈
- binary key: `-bin` 접미사 (예: `grpc-trace-bin`, `auth-cert-bin`)

### 4-2. 송수신

```kotlin
// 클라 측 — 송신
val headers = Metadata().apply {
    put(Metadata.Key.of("x-request-id", Metadata.ASCII_STRING_MARSHALLER), UUID.randomUUID().toString())
    put(Metadata.Key.of("trace-bin", Metadata.BINARY_BYTE_MARSHALLER), traceContext.toByteArray())
}
val attached = MetadataUtils.attachHeaders(stub, headers)
attached.getProduct(req)

// 서버 측 — 수신 (Interceptor)
val requestId = headers.get(Metadata.Key.of("x-request-id", Metadata.ASCII_STRING_MARSHALLER))
```

### 4-3. 표준 metadata 키

| 키 | 용도 |
|---|---|
| `:authority` | Host (HTTP/2 pseudo header) |
| `:path` | RPC 경로 (`/commerce.ProductService/GetProduct`) |
| `grpc-timeout` | deadline (자동) |
| `grpc-encoding` / `grpc-accept-encoding` | 압축 협상 |
| `grpc-status` / `grpc-message` | 응답 trailers |
| `user-agent` | 클라 식별 |
| `authorization` | JWT / API 키 (custom) |

## 5. Retry / Hedging (gRPC 자체 정책)

gRPC-java 1.20+ 부터 service config 로 클라 측 retry 정책 선언 가능. **Resilience4j 같은 별도 레이어 없이** 처리 가능.

### 5-1. Service config 예

```json
{
  "methodConfig": [
    {
      "name": [{"service": "commerce.product.v1.ProductService", "method": "GetProduct"}],
      "retryPolicy": {
        "maxAttempts": 4,
        "initialBackoff": "0.1s",
        "maxBackoff": "1s",
        "backoffMultiplier": 2,
        "retryableStatusCodes": ["UNAVAILABLE"]
      },
      "timeout": "1s"
    }
  ]
}
```

```kotlin
val channel = NettyChannelBuilder.forAddress("product", 9090)
    .defaultServiceConfig(serviceConfig)
    .enableRetry()
    .build()
```

### 5-2. Hedging (병렬 retry)

```json
"hedgingPolicy": {
  "maxAttempts": 3,
  "hedgingDelay": "0.05s",
  "nonFatalStatusCodes": []
}
```

- maxAttempts 만큼 **병렬** 호출, 가장 먼저 응답하는 결과 채택
- tail latency 줄임 (read-heavy idempotent RPC)
- 비용 ↑ (요청 N 배), 위험 — **반드시 idempotent 한 RPC 만**

### 5-3. Retry 와 idempotency

- gRPC 의 retry 는 *transparent* — 멱등 보장은 클라이언트가 책임
- `INVALID_ARGUMENT` / `NOT_FOUND` / `PERMISSION_DENIED` 는 retry 무의미
- **`UNAVAILABLE` / `DEADLINE_EXCEEDED` (조건부)** 만 retry 후보
- write RPC 는 idempotency key (custom metadata) 패턴과 결합

### 5-4. msa 의 Resilience4j 와 비교

현 msa: WebClient + Resilience4j CircuitBreaker (ADR-0015)

| 비교 | gRPC service config | Resilience4j |
|---|---|---|
| 정의 위치 | JSON config (런타임 변경 가능) | 코드 또는 application.yml |
| 정책 종류 | retry, hedging, timeout | retry, circuit breaker, rate limiter, bulkhead, retry, timeout |
| Circuit breaker | gRPC 자체 X (xDS 로 외부 위임 가능) | 풀 지원 |
| 통합 | gRPC stub 자동 | suspend function wrapper |

⇒ **Resilience4j 는 여전히 필요** (특히 circuit breaker). gRPC retry 는 보조.

## 6. Compression

```kotlin
val stub = ProductServiceGrpcKt.ProductServiceCoroutineStub(channel)
    .withCompression("gzip")     // 클라 → 서버 압축

// 서버 측 응답 압축은 ServerInterceptor 또는 ServerCallHandler 에서 set
```

- 작은 메시지는 무의미 (CPU > 절감)
- 큰 페이로드 (이미지, 큰 product list) 만 켤 것
- per-RPC 또는 per-channel 설정 가능

## 7. Context 와 thread-local 대체

```kotlin
val USER_ID_KEY: Context.Key<String> = Context.key("user_id")

// Interceptor 가 set
val ctx = Context.current().withValue(USER_ID_KEY, claims.subject)
Contexts.interceptCall(ctx, call, headers, next)

// 서비스 핸들러에서 읽기
override suspend fun getProduct(req: GetProductRequest): GetProductResponse {
    val userId = USER_ID_KEY.get(Context.current())
    log.info("getProduct by user={}", userId)
    ...
}
```

- gRPC `Context` = thread-local 의 비동기 안전 버전
- coroutine 에서는 자동으로 따라옴 (grpc-kotlin 통합)
- MDC / Spring SecurityContext 와 분리되므로 bridge interceptor 필요

## 8. Health checking + reflection

### 8-1. Health check (`grpc.health.v1.Health`)

- gRPC 표준 health check 서비스
- K8s readiness/liveness probe 가 gRPC native 로 호출 가능 (1.24+)
  ```yaml
  livenessProbe:
    grpc:
      port: 9090
  ```
- 또는 `grpc_health_probe` 바이너리 사용

### 8-2. Server reflection

- 클라가 schema 사전 모르고 서비스의 proto 를 동적으로 발견
- `grpcurl -plaintext localhost:9090 list` 같은 디버깅에 필수
- 운영 환경은 비활성 권장 (정보 노출)

## 9. msa 의 ADR-0015 와 결합 시나리오

| 현재 (REST) | gRPC 도입 시 매핑 |
|---|---|
| WebClient timeout = 5s | gRPC `withDeadlineAfter(5s)` (자동 전파!) |
| Resilience4j CircuitBreaker | 그대로 유지 (interceptor 로 wrap) |
| Resilience4j Retry | gRPC service config retry 로 대체 가능 |
| MDC 로 traceId 전파 | gRPC Context + interceptor 로 자동 |
| custom header `X-Request-Id` | gRPC metadata 로 자연스럽게 |
| GlobalExceptionHandler | ServerInterceptor 의 onClose 에서 status 변환 |

## 10. 면접 핵심

> Q: gRPC 의 deadline propagation 이란?

A: 클라가 RPC 호출 시 deadline (절대 시각 timeout) 을 부여하면, 서버가 다른 gRPC 를 호출할 때 *남은 시간*을 자동으로 downstream 에 전파하는 기능. 어느 hop 에서든 만료되면 즉시 cancel 신호가 전파되어 자원 회수. REST 에는 표준이 없어 수동 헤더로 흉내 내야 함.

> Q: gRPC metadata 와 HTTP 헤더의 차이는?

A: 본질적으로 HTTP/2 의 HEADERS / trailers 위에 매핑되는 key-value. 차이점: (a) gRPC 가 표준화된 키 (`grpc-timeout`, `grpc-status`) 를 정의, (b) `-bin` 접미사로 binary value 지원, (c) ASCII 헤더는 소문자만, (d) HPACK 압축 + sensitive flag 활용.

> Q: gRPC retry 와 Resilience4j 둘 다 쓸 이유?

A: gRPC retry 는 transient failure (`UNAVAILABLE`) 의 단순 재시도. Resilience4j 는 circuit breaker / bulkhead 등 retry 외 패턴 지원. 둘은 다른 레이어 — gRPC retry 는 transport 가까이, Resilience4j 는 비즈 코드 가까이.

## 다음 학습

- [10-load-balancing.md](10-load-balancing.md) — Interceptor 와 LB 의 결합
- [12-auth-mtls-jwt.md](12-auth-mtls-jwt.md) — Metadata + JWT 통합
