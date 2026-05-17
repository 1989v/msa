---
parent: 16-async-nonblocking-io
seq: 20
title: Reactor + Netty Pipeline 심화 — Operator · Backpressure · ChannelHandler · WebFlux 내부
type: deep-dive
created: 2026-05-05
updated: 2026-05-05
status: completed
related:
  - 99-concept-catalog.md
  - 09-netty-internals.md
  - 10-project-reactor.md
  - 11-backpressure.md
  - 12-webflux-vs-mvc.md
  - 15-msa-gateway-webflux.md
sources:
  - https://projectreactor.io/docs/core/release/reference/
  - https://projectreactor.io/docs/netty/release/reference/
  - https://netty.io/wiki/
  - https://docs.spring.io/spring-framework/reference/web/webflux.html
  - "Reactive Streams 1.0.4 spec — https://www.reactive-streams.org/"
  - "Netty in Action (Norman Maurer, 2015)"
  - https://github.com/grpc/grpc-java/blob/master/netty/src/main/java/io/grpc/netty/NettyServerBuilder.java
catalog-row: "Reactor (Mono/Flux/Schedulers/Backpressure/Context/Sinks) + Netty (ChannelPipeline/EventLoop/ByteBuf/Codec) + WebFlux 내부 (DispatcherHandler/HandlerMapping) + msa gateway"
---

# 20. Reactor + Netty Pipeline 심화

## TL;DR

- **Project Reactor** = JVM (Java Virtual Machine, 자바 가상 머신) Reactive Streams 구현. **Mono (0..1) / Flux (0..N)**. operator chain 은 *2 단계* — assembly time (선언) + subscription time (실행).
- **Netty** = NIO (Non-blocking I/O) 기반 이벤트 드리븐 네트워킹 프레임워크. **EventLoopGroup + ChannelPipeline + ChannelHandler chain**.
- **Reactor Netty** = Reactor + Netty 통합. WebFlux / Spring Cloud Gateway 의 기본 HTTP server.
- **Backpressure** = downstream 의 처리 속도에 맞춰 upstream 을 조절. `BUFFER / DROP / LATEST / ERROR / 사용자 정의`.
- **WebFlux 내부** = `DispatcherHandler → HandlerMapping → HandlerAdapter` (Spring MVC 의 reactive 버전).
- **msa 적용** = `gateway` 가 Spring Cloud Gateway = WebFlux + Reactor Netty.

---

## 1. Reactive Streams 표준 복습

### 1.1 4 인터페이스

```java
public interface Publisher<T> {
    void subscribe(Subscriber<? super T> s);
}

public interface Subscriber<T> {
    void onSubscribe(Subscription s);
    void onNext(T t);
    void onError(Throwable t);
    void onComplete();
}

public interface Subscription {
    void request(long n);   // ← backpressure 의 핵심
    void cancel();
}

public interface Processor<T, R> extends Subscriber<T>, Publisher<R> {}
```

JDK 9+ 의 `java.util.concurrent.Flow` 와 1:1 매핑.

### 1.2 동작 흐름

```
Subscriber.onSubscribe(sub)
  ↓ (sub.request(N) — N 개만 요청)
Publisher 가 N 개까지 onNext 호출
  ↓ (다 처리하면)
Subscriber.onSubscribe 에서 다시 request
  ↓ (또는 cancel)
완료 시 onComplete / onError
```

→ **pull-based** — Subscriber 가 *요청한 만큼만* 받음. 이게 Reactive Streams 의 핵심 차별점.

---

## 2. Mono / Flux — Cold Publisher

### 2.1 정의

```kotlin
val mono: Mono<String> = Mono.just("hello")
val flux: Flux<Int> = Flux.range(1, 100)
```

`subscribe()` 호출 전엔 *아무 일도 일어나지 않음* (cold).

### 2.2 Assembly time vs Subscription time

```kotlin
val pipeline = Flux.range(1, 100)
    .map { it * 2 }            // ← assembly time: operator 등록
    .filter { it > 50 }
    .doOnNext { println(it) }

// 여기까지 아무 일도 안 일어남

pipeline.subscribe()             // ← subscription time: 실제 실행
```

**중요**: assembly time 의 코드는 *람다 등록만*. 실제 람다 실행은 subscription time. → 디버깅 시 stack trace 가 *직관적이지 않음* (assembly point 보이지 않음).

→ 해결: `Hooks.onOperatorDebug()` (개발 시), `checkpoint()` operator (특정 지점 식별).

### 2.3 흔한 operator

| operator | 의미 |
|---|---|
| `map(fn)` | T → R 변환 |
| `flatMap(fn)` | T → Publisher<R> 평탄화 (concat 순서 보장 X) |
| `concatMap(fn)` | flatMap + 순서 보장 |
| `filter(p)` | 조건 만족만 통과 |
| `zip(a, b)` | 두 Publisher 의 결과 짝지음 |
| `merge(a, b)` | 두 Publisher 의 결과 인터리브 |
| `then(other)` | 완료 후 other 시작 |
| `switchIfEmpty(alt)` | empty 면 alt |
| `defaultIfEmpty(v)` | empty 면 v 한 번 emit |
| `take(n)` / `skip(n)` | 처음 / 마지막 N |
| `buffer(n)` / `window(n)` | N 개씩 묶음 (List / Flux) |

---

## 3. Hot vs Cold Publisher

### 3.1 차이

| 종류 | 시점 | 멀티 구독자 |
|---|---|---|
| Cold | subscribe 마다 *처음부터* 시작 | 각자 독립 stream |
| Hot | subscribe 무관 *진행 중* | 공유, 늦게 구독하면 못 본 데이터 잃음 |

### 3.2 Sinks (Reactor 3.4+) — hot 만들기

```kotlin
val sink: Sinks.Many<Int> = Sinks.many().multicast().onBackpressureBuffer()
val flux: Flux<Int> = sink.asFlux()

// publisher
sink.tryEmitNext(1)
sink.tryEmitNext(2)
sink.tryEmitComplete()

// subscriber
flux.subscribe { println(it) }
```

3 가지 Sink 종류:
- `Sinks.One` — Mono 와 등가, 단일 emission
- `Sinks.Many.unicast()` — 1 구독자만
- `Sinks.Many.multicast()` — N 구독자, late join OK
- `Sinks.Many.replay()` — N 구독자 + 과거 emission 재생

### 3.3 share / cache / replay

```kotlin
val cold = Flux.fromIterable(listOf(1, 2, 3))

cold.share()      // 첫 subscribe 부터 hot. 늦게 join 하면 못 본 거 손실
cold.cache(10)    // hot + 마지막 10 개 새 구독자에게 replay
cold.replay()     // hot + ConnectableFlux (.connect() 호출 필요)
```

---

## 4. Backpressure 전략

### 4.1 문제 — Slow Consumer

```
Producer: 1000 events/s
Consumer: 100 events/s
→ 900/s 가 어디로? 메모리 폭증 OOM (Out Of Memory, 메모리 부족)
```

### 4.2 Reactor 의 `onBackpressureXxx` operator

```kotlin
flux.onBackpressureBuffer()              // 무제한 버퍼 (위험)
flux.onBackpressureBuffer(1000)          // 한도 + 초과 시 ERROR
flux.onBackpressureBuffer(1000, BufferOverflowStrategy.DROP_OLDEST)
flux.onBackpressureDrop()                // 초과는 drop
flux.onBackpressureDrop { dropped -> log.warn("dropped: $dropped") }
flux.onBackpressureLatest()              // 가장 최근 1 개만 보존
flux.onBackpressureError()               // 초과 시 즉시 에러
```

### 4.3 request(n) 직접 제어

```kotlin
flux.subscribe(object : BaseSubscriber<Int>() {
    override fun hookOnSubscribe(sub: Subscription) {
        sub.request(10)   // 처음 10 개만 요청
    }
    override fun hookOnNext(value: Int) {
        process(value)
        if (counter % 10 == 0) request(10)   // 10 개씩 추가 요청
    }
})
```

### 4.4 흔한 패턴

| 시나리오 | 권장 |
|---|---|
| 클라이언트 stream | BUFFER 제한 + ERROR (서버 보호) |
| 실시간 시세 (오래된 가격 무가치) | LATEST |
| 로그 stream (잃어도 OK) | DROP |
| 결제 / 주문 (절대 잃으면 안 됨) | BUFFER 무제한 위험 → 별도 큐 (Kafka) |
| 웹소켓 push | LATEST 또는 limited BUFFER |

---

## 5. Schedulers

### 5.1 5 종

| Scheduler | 용도 |
|---|---|
| `Schedulers.parallel()` | CPU bound, ncpu 개 worker |
| `Schedulers.boundedElastic()` | blocking IO 격리, default 10× ncpu, 최대 100K queue |
| `Schedulers.single()` | 1 thread (sequential 보장) |
| `Schedulers.immediate()` | 호출자 thread 그대로 |
| `Schedulers.fromExecutor(exec)` | 임의 ExecutorService 래핑 |

### 5.2 publishOn vs subscribeOn — 가장 헷갈리는 개념

```kotlin
val flux = Flux.range(1, 5)
    .map { it * 2 }                         // (1)
    .publishOn(Schedulers.parallel())        // ← 이 시점부터 downstream 이 parallel
    .filter { it > 5 }                       // (2)
    .subscribeOn(Schedulers.boundedElastic()) // ← upstream 전체에 영향
    .subscribe()
```

규칙:
- **`subscribeOn`** — *subscription chain* 이 시작되는 thread 결정 → upstream 전체 (소스) 에 영향
- **`publishOn`** — *그 이후* operator 의 thread 변경 → downstream 만 영향

```
subscribeOn(boundedElastic): Flux.range, map (1) 까지 boundedElastic
publishOn(parallel): filter (2) 부터 parallel
subscribe(): parallel
```

여러 publishOn 가능 — 각각 그 시점부터 다음까지 적용.

### 5.3 boundedElastic — blocking 격리 전용

```kotlin
val result = Mono.fromCallable {
    blockingDbCall()   // ← blocking
}.subscribeOn(Schedulers.boundedElastic())
```

`parallel` 에 blocking 호출하면 *전체 parallel pool 고갈* → reactive system 이 멈춤.

---

## 6. Reactor Context — request-scoped state

### 6.1 ThreadLocal 의 한계

Reactive 환경은 *thread 가 자주 바뀜* (publishOn, subscribeOn 으로) → ThreadLocal 사용 불가능.

### 6.2 Reactor Context

```kotlin
fun fetchUser(): Mono<User> = Mono.deferContextual { ctx ->
    val tenantId = ctx.get<String>("tenantId")
    repo.findByTenant(tenantId)
}

fetchUser()
    .contextWrite { it.put("tenantId", "acme") }
    .subscribe()
```

특징:
- **immutable** — `contextWrite` 는 새 Context 생성
- **downstream → upstream 전파** — 위쪽에서 쓰여 *아래쪽이 읽음* (반대 방향이 직관적이지 않음)
- 보통 use-case: tenantId, traceId, userId, security context

### 6.3 ThreadLocal bridging

```kotlin
// kotlinx-coroutines-reactor / Micrometer Context Propagation 사용
Hooks.enableAutomaticContextPropagation()

val mdc = Mono.deferContextual { ctx ->
    val traceId = ctx.get<String>("traceId")
    MDC.put("traceId", traceId)   // ← ThreadLocal 에 복원
    Mono.just("ok")
}
```

Spring Cloud Sleuth / Micrometer Tracing 이 이걸 자동 처리.

---

## 7. Operator 함정

### 7.1 Blocking 호출 함정

```kotlin
// ❌
flux.map { item ->
    blockingHttpCall(item)   // ← parallel pool worker 점유
}
```

→ 해결:
```kotlin
flux.flatMap { item ->
    Mono.fromCallable { blockingHttpCall(item) }
        .subscribeOn(Schedulers.boundedElastic())
}
```

### 7.2 `.block()` / `.toFuture()` 함정

```kotlin
// ❌ Reactor 안에서 .block()
flux.map { item ->
    otherMono.block()   // 전체 reactive pipeline 의미 없음
}
```

`block()` 은 reactive context 밖 (e.g. test, main) 에서만.

### 7.3 Hot publisher 의 데이터 손실

```kotlin
val sink = Sinks.many().multicast().directBestEffort()
sink.tryEmitNext(1)   // ← 아직 구독자 없음 → 사라짐
sink.asFlux().subscribe { println(it) }
sink.tryEmitNext(2)   // ← 받음
```

→ 해결: `replay()` 또는 `onBackpressureBuffer()`.

### 7.4 Map vs FlatMap 순서

```kotlin
flux.flatMap { fetchAsync(it) }      // 순서 보장 X (concurrent)
flux.concatMap { fetchAsync(it) }    // 순서 보장 (sequential)
flux.flatMapSequential { fetchAsync(it) }  // concurrent 실행 + 순서 정렬
```

---

## 8. Netty 기초

### 8.1 EventLoopGroup

```java
EventLoopGroup boss = new NioEventLoopGroup(1);     // accept() 전담
EventLoopGroup worker = new NioEventLoopGroup();    // IO 처리, default ncpu * 2

ServerBootstrap b = new ServerBootstrap();
b.group(boss, worker)
 .channel(NioServerSocketChannel.class)
 .childHandler(new ChannelInitializer<SocketChannel>() {
     protected void initChannel(SocketChannel ch) {
         ch.pipeline().addLast(new HttpServerCodec());
         ch.pipeline().addLast(new MyHandler());
     }
 })
 .bind(8080);
```

- **boss group** — accept 전담 (보통 1 개)
- **worker group** — IO 이벤트 처리 (channel 별 1 EventLoop 고정)
- 한 channel = 한 EventLoop 평생 (thread affinity)

### 8.2 Native transport — Epoll / KQueue / IOUring

```java
// Linux
EventLoopGroup worker = new EpollEventLoopGroup();
b.channel(EpollServerSocketChannel.class);

// macOS BSD
EventLoopGroup worker = new KQueueEventLoopGroup();

// Linux 5.1+
EventLoopGroup worker = new IOUringEventLoopGroup();  // incubator
b.channel(IOUringServerSocketChannel.class);
```

native transport 는 NIO 보다 빠름 (system call 절감, epoll 직접 호출). 단 plat-specific JNI lib 필요.

---

## 9. ChannelPipeline + Handler

### 9.1 구조

```
ChannelPipeline = doubly-linked list of ChannelHandler

inbound (read 방향):
  socket → DECODER → BUSINESS_HANDLER → ...

outbound (write 방향):
  ... → ENCODER → socket
```

### 9.2 Handler 종류

| 종류 | base class | 역할 |
|---|---|---|
| Inbound | `ChannelInboundHandlerAdapter` | read 이벤트 처리 |
| Outbound | `ChannelOutboundHandlerAdapter` | write 이벤트 처리 |
| Duplex | `ChannelDuplexHandler` | 양방향 |
| Codec | `ByteToMessageDecoder` / `MessageToByteEncoder` | 디코더 / 인코더 |
| Combined | `MessageToMessageCodec<I,O>` | T1 ↔ T2 양방향 변환 |

### 9.3 Inbound 흐름

```java
class HelloHandler extends SimpleChannelInboundHandler<HttpRequest> {
    @Override
    protected void channelRead0(ChannelHandlerContext ctx, HttpRequest req) {
        var resp = new DefaultFullHttpResponse(HTTP_1_1, OK,
            Unpooled.wrappedBuffer("hi".getBytes()));
        ctx.writeAndFlush(resp);
    }
}
```

`channelRead0` 은 *EventLoop thread* 에서 실행 → blocking 금지. 무거운 작업은 `EventExecutorGroup` 으로 offload:

```java
ch.pipeline().addLast(workerGroup, "business", new BusinessHandler());
```

### 9.4 Outbound 흐름

write 는 *역방향*. 마지막 handler 부터 codec 까지.

```java
ctx.writeAndFlush(message);   // pipeline 끝에서 시작 → encoder → socket
```

### 9.5 ChannelHandlerContext

```java
ctx.channel()             // Channel
ctx.executor()            // EventExecutor (= EventLoop)
ctx.pipeline()            // Pipeline
ctx.fireChannelRead(msg)  // 다음 inbound handler 로 전파
ctx.write(msg)            // 다음 outbound handler 로 (flush 안 함)
ctx.flush()               // pending write 비움
```

---

## 10. ByteBuf

### 10.1 Direct vs Heap

```java
ByteBufAllocator alloc = ByteBufAllocator.DEFAULT;
ByteBuf direct = alloc.directBuffer(1024);  // off-heap, kernel 친화
ByteBuf heap   = alloc.heapBuffer(1024);    // on-heap, GC 대상
```

trade-off:
- **direct** — `DMA (Direct Memory Access)` 친화, socket write 시 zero-copy. 단 native memory 사용 → JVM heap 모니터링으로 안 잡힘.
- **heap** — GC 됨, 안전. 단 socket 쓸 땐 어차피 native memory 로 복사.

→ Netty default = **direct + pooled**.

### 10.2 Pooled — `PooledByteBufAllocator`

ByteBuf 마다 native alloc 호출 비용이 큼 → **pool 에서 재사용**.

```java
PooledByteBufAllocator alloc = PooledByteBufAllocator.DEFAULT;
ByteBuf buf = alloc.directBuffer(1024);
// ... 사용
buf.release();   // ← pool 반환 (필수)
```

### 10.3 Reference Counting

```java
ByteBuf buf = alloc.buffer(1024);
buf.refCnt();  // 1
buf.retain();  // 2
buf.release(); // 1
buf.release(); // 0 → pool 반환
```

**누수 (memory leak)** 가 가장 흔한 Netty 버그. `-Dio.netty.leakDetection.level=PARANOID` 로 추적.

### 10.4 SimpleChannelInboundHandler 의 자동 release

```java
class MyHandler extends SimpleChannelInboundHandler<ByteBuf> {
    protected void channelRead0(ChannelHandlerContext ctx, ByteBuf msg) {
        // ← 메서드 끝나면 자동으로 release
    }
}
```

`ChannelInboundHandlerAdapter` 직접 사용 시엔 *수동 release 필요*.

---

## 11. Codec — Decoder / Encoder / Framing

### 11.1 LengthFieldBasedFrameDecoder

TCP 는 stream → 메시지 경계 없음. 헤더에 length 박는 protocol 의 표준 framing:

```
[ length (4 bytes) | payload (length bytes) ]
```

```java
ch.pipeline().addLast(new LengthFieldBasedFrameDecoder(
    1024 * 1024,  // maxFrameLength
    0,            // lengthFieldOffset
    4,            // lengthFieldLength
    0,            // lengthAdjustment
    4             // initialBytesToStrip (length 4 byte 제거)
));
ch.pipeline().addLast(new ProtobufDecoder(MyMessage.getDefaultInstance()));
```

### 11.2 LineBasedFrameDecoder / DelimiterBasedFrameDecoder

`\n` 또는 임의 delimiter 로 분리. text protocol (HTTP/0.9, SMTP, IMAP) 에 적합.

### 11.3 HttpServerCodec

```
HttpRequestDecoder + HttpResponseEncoder + HttpObjectAggregator
```

Netty 의 HTTP/1.1 codec. `HttpObjectAggregator` 는 chunked → full message 합침 (메모리 주의).

### 11.4 사용자 Codec

```java
class MyDecoder extends ByteToMessageDecoder {
    protected void decode(ChannelHandlerContext ctx, ByteBuf in, List<Object> out) {
        if (in.readableBytes() < 4) return;  // 헤더 부족 → 더 받기
        int length = in.readInt();
        if (in.readableBytes() < length) {
            in.resetReaderIndex();   // 페이로드 부족 → rollback
            return;
        }
        byte[] payload = new byte[length];
        in.readBytes(payload);
        out.add(parseMessage(payload));
    }
}
```

---

## 12. HTTP/2 + Reactor Netty

### 12.1 Multiplexing

HTTP/1.1 = 한 connection 당 한 request (또는 pipelining 제한적). HTTP/2 = 한 connection 으로 *N 개 stream 다중화*.

```java
HttpServer.create()
    .protocol(HttpProtocol.H2)   // HTTP/2
    .secure(spec -> spec.sslContext(sslCtx))
    .route(routes -> routes.get("/", (req, res) -> res.sendString(Mono.just("hi"))))
    .bindNow();
```

### 12.2 HPACK — header compression

HTTP/2 의 헤더 압축. 같은 connection 의 후속 요청에서 헤더 *증분 전송*.

→ 결과: 헤더 traffic 5-10× 절감.

### 12.3 Stream priority / Server Push

- Stream priority: 의존 graph + weight 로 우선순위 지정 (브라우저가 사용)
- Server Push: server 가 client 요청 전 미리 push (deprecated 추세)

### 12.4 HTTP/3 (QUIC)

UDP 위 QUIC (Quick UDP Internet Connections). Netty HTTP/3 incubator 에 있음.
- 0-RTT 재연결
- multiplexing without head-of-line blocking
- TLS 1.3 내장

---

## 13. WebFlux 내부

### 13.1 핵심 컴포넌트

```
HTTP Request
   ↓
DispatcherHandler
   ↓ (HandlerMapping 들에 위임)
HandlerMapping (RequestMappingHandlerMapping / RouterFunctionMapping)
   ↓ (handler 찾음)
HandlerAdapter (RequestMappingHandlerAdapter / HandlerFunctionAdapter)
   ↓ (handler 호출)
Controller / RouterFunction
   ↓
HandlerResultHandler (ViewResolutionResultHandler / ResponseEntityResultHandler)
   ↓
HTTP Response
```

→ Spring MVC 의 `DispatcherServlet → HandlerMapping → HandlerAdapter → ViewResolver` 와 평행 구조 (전체 reactive).

### 13.2 Annotation 모델

```kotlin
@RestController
class ProductController(private val service: ProductService) {
    @GetMapping("/products/{id}")
    fun get(@PathVariable id: Long): Mono<Product> = service.findById(id)
}
```

### 13.3 Functional / Router 모델

```kotlin
@Configuration
class ProductRoutes {
    @Bean
    fun routes(handler: ProductHandler) = router {
        GET("/products/{id}", handler::get)
        POST("/products", handler::create)
    }
}

@Component
class ProductHandler(private val service: ProductService) {
    fun get(req: ServerRequest): Mono<ServerResponse> {
        val id = req.pathVariable("id").toLong()
        return service.findById(id).flatMap { ServerResponse.ok().bodyValue(it) }
    }
}
```

### 13.4 WebFilter — Servlet Filter 의 reactive 버전

```kotlin
@Component
class TraceWebFilter : WebFilter {
    override fun filter(exchange: ServerWebExchange, chain: WebFilterChain): Mono<Void> {
        val traceId = exchange.request.headers["X-Trace-Id"]?.firstOrNull() ?: UUID.randomUUID().toString()
        return chain.filter(exchange).contextWrite { it.put("traceId", traceId) }
    }
}
```

### 13.5 Reactor Netty 통합

WebFlux 의 default server = **Reactor Netty** (`reactor-netty-http`). Tomcat / Undertow / Jetty 도 가능 (servlet async 위 어댑터).

```yaml
# application.yml
server:
  port: 8080
  netty:
    connection-timeout: 30s
    idle-timeout: 60s
    max-keep-alive-requests: 100
```

---

## 14. gRPC + Netty

### 14.1 grpc-java 구조

```
NettyServerBuilder
   ↓ (ChannelHandler chain 등록)
EventLoopGroup
   ↓
HTTP/2 codec (Netty 의 Http2FrameCodec)
   ↓
gRPC server stream handler
   ↓
ServerCall.Listener
```

### 14.2 Reactor wrapper — `salesforce/reactive-grpc`

```kotlin
class ProductServiceImpl : ReactorProductServiceGrpc.ProductServiceImplBase() {
    override fun get(req: Mono<ProductRequest>): Mono<ProductResponse> = req
        .flatMap { service.findById(it.id) }
        .map { ProductResponse.newBuilder().setName(it.name).build() }
}
```

→ stub / impl 모두 Mono / Flux 로 받음. backpressure 가 grpc-stream 과 자연스럽게 매핑.

---

## 15. msa 적용 — gateway

### 15.1 현재 gateway 구조

```
gateway/
  src/main/kotlin/com/kgd/gateway/
    GatewayApplication.kt
    config/
      RouteConfig.kt          ← Spring Cloud Gateway routes
      RateLimitConfig.kt
    filter/
      AuthenticationGatewayFilter.kt
      VisitorIdFilter.kt
      RequestLoggingFilter.kt
      ExperimentAssignmentFilter.kt
```

stack: **Spring Cloud Gateway = WebFlux + Reactor Netty**. 모든 filter 가 Reactor `Mono<Void>` 반환.

### 15.2 AuthenticationGatewayFilter 분석

```kotlin
// gateway/src/main/kotlin/com/kgd/gateway/filter/AuthenticationGatewayFilter.kt
@Component
class AuthenticationGatewayFilter : AbstractGatewayFilterFactory<...>() {
    override fun apply(config: Config): GatewayFilter = GatewayFilter { exchange, chain ->
        val token = exchange.request.headers["Authorization"]?.firstOrNull()
        if (token == null || !verify(token)) {
            exchange.response.statusCode = HttpStatus.UNAUTHORIZED
            return@GatewayFilter exchange.response.setComplete()  // Mono<Void>
        }
        chain.filter(exchange)
    }
}
```

→ 핵심: `verify(token)` 이 *blocking* 이면 EventLoop 막힘. JWT (JSON Web Token) 검증은 CPU 만 → OK. JWKS 페치 (HTTP) 는 *Mono 로 변환* 필요.

```kotlin
return jwksClient.fetch()    // Mono<JwkSet>
    .flatMap { jwks -> Mono.fromCallable { verify(token, jwks) } }
    .flatMap { ok ->
        if (ok) chain.filter(exchange)
        else { exchange.response.statusCode = UNAUTHORIZED; exchange.response.setComplete() }
    }
```

### 15.3 RouteConfig — backend 라우팅

```kotlin
@Configuration
class RouteConfig {
    @Bean
    fun routes(builder: RouteLocatorBuilder): RouteLocator = builder.routes()
        .route("product") { it.path("/api/products/**").uri("http://product-service.default:8080") }
        .route("order") { it.path("/api/orders/**").uri("http://order-service.default:8080") }
        .build()
}
```

→ K8s DNS 로 backend 라우팅. Reactor Netty client 가 connection pool 관리.

### 15.4 RateLimitConfig — Reactor Netty + Redis

`spring-cloud-gateway-server` 의 `RequestRateLimiter` filter 는 **Reactive Redis** (Lettuce) + token bucket 알고리즘:

```kotlin
@Bean
fun userKeyResolver(): KeyResolver = KeyResolver { exchange ->
    Mono.justOrEmpty(exchange.request.headers["X-User-Id"]?.firstOrNull())
}

// route 적용
.filters {
    it.requestRateLimiter { config ->
        config.rateLimiter = redisRateLimiter
        config.keyResolver = userKeyResolver()
    }
}
```

→ 모든 filter chain 이 *non-blocking* — gateway 의 throughput 이 backend 의 latency 와 *독립적*.

### 15.5 latency budget (cross-ref → 12 글)

gateway 가 *non-blocking* 이라는 뜻:
- gateway 의 EventLoop 는 절대 block 되면 안 됨
- backend 가 느려도 gateway 의 다른 connection 처리 영향 X
- 단, Reactor Netty 의 connection pool 은 *유한* → backend 의 max in-flight 가 gateway 의 한계

→ **latency budget 설계 시점에 명시** ([study/docs/12-latency-numbers](../12-latency-numbers/) 참조).

### 15.6 잠재 함정

| 함정 | 영향 | 해결 |
|---|---|---|
| filter 안 blocking call | EventLoop 정지, 전체 gateway 멈춤 | `Mono.fromCallable + boundedElastic` |
| Reactor Context 전파 누락 | tracing / MDC 깨짐 | `Hooks.enableAutomaticContextPropagation()` |
| ByteBuf leak | native memory 누수, OOM | leak detector PARANOID |
| `block()` 호출 | `IllegalStateException` | reactive 끝까지 유지 |
| backpressure 미설정 | downstream slow → buffer 폭증 | `onBackpressureBuffer(N, ERROR)` |

### 15.7 search:app 의 reactive client

`search/app` 은 ES Java client 사용 — 일부 `_search` 호출은 reactive client 옵션 가능:

```kotlin
// 가설적
val client = ReactiveElasticsearchClient.create(...)

fun search(query: Query): Flux<Document> = client.search(query)
    .map { it.toDocument() }
    .onBackpressureBuffer(1000, BufferOverflowStrategy.DROP_OLDEST)
```

→ 현재 msa 의 search:app 은 blocking client. reactive 도입 시 throughput ↑, 단 코드 복잡도 ↑. trade-off.

---

## 16. 면접 질문 대비

### Q1. publishOn 과 subscribeOn 의 차이

> `subscribeOn` 은 *subscription chain* 의 시작점 thread 결정 → 소스 (upstream) 전체에 영향. 한 chain 에 여러 subscribeOn 이 있으면 *가장 위쪽 (소스 가까이)* 의 것만 효과. `publishOn` 은 그 시점부터 *downstream* 의 thread 변경. 여러 publishOn 가능.

### Q2. Cold vs Hot Publisher

> Cold: subscribe 마다 *처음부터* 시작. Mono.just / Flux.fromIterable 등. 각 구독자는 독립 stream. Hot: subscribe 시점과 무관하게 *진행 중*. Sinks / share / WebSocket / event bus. 늦게 join 하면 못 본 데이터 잃음 (replay 옵션 별도).

### Q3. Reactor Context 가 필요한 이유

> Reactive 환경은 thread 가 자주 바뀜 (publishOn / subscribeOn) → ThreadLocal 사용 불가. Reactor Context 는 *immutable + downstream-to-upstream 전파* 모델로 request scope 데이터 (tenantId, traceId, userId) 운반. `Hooks.enableAutomaticContextPropagation()` 로 ThreadLocal bridging 자동화.

### Q4. Netty 의 EventLoop pinning

> 한 channel 은 한 EventLoop 에 평생 binding (thread affinity). 그래서 EventLoop thread 안에서 blocking 호출하면 *그 EventLoop 가 담당하는 모든 channel 정지*. 해결: `EventExecutorGroup` 으로 무거운 handler offload 또는 reactive (Mono.subscribeOn(boundedElastic)).

### Q5. ByteBuf reference counting

> Netty 의 ByteBuf 는 *pool 에서 재사용* → 자동 GC 안 됨. retain() / release() 로 명시 관리. SimpleChannelInboundHandler 는 자동 release. ChannelInboundHandlerAdapter 는 수동. leak 추적은 `-Dio.netty.leakDetection.level=PARANOID`.

### Q6. WebFlux 가 MVC 보다 항상 빠른가?

> 아니오. **CPU bound + 짧은 latency** 시나리오에선 차이 없음. WebFlux 의 강점은 **high concurrency + long IO wait**. blocking IO 가 많은 시나리오에서 thread pool 고갈 회피. 단 코드 복잡도 ↑ + 디버깅 난이도 ↑. JDK 21+ 의 Virtual Thread 와 비교 시 WebFlux 의 입지가 좁아지는 추세.

### Q7. Spring Cloud Gateway 는 어떻게 동작하나?

> WebFlux + Reactor Netty 기반. Route → Predicate → Filter chain → backend forwarding. 모든 filter 가 non-blocking `Mono<Void>` 반환. backend 호출은 Reactor Netty client 가 connection pool 로 관리. K8s 환경에선 service DNS 로 직접 라우팅 (LoadBalancer 어노테이션 없이).

---

## 17. 학습 체크포인트

- [ ] Mono / Flux 의 assembly time vs subscription time 설명
- [ ] publishOn / subscribeOn 위치별 동작 그리기
- [ ] Backpressure 5 전략 — BUFFER / DROP / LATEST / ERROR / 사용자
- [ ] Reactor Context 의 downstream-to-upstream 전파
- [ ] Netty 의 boss / worker / EventLoop 구조
- [ ] ChannelPipeline 의 inbound / outbound 흐름
- [ ] ByteBuf 의 direct vs heap, pooled, refCnt
- [ ] LengthFieldBasedFrameDecoder 의 framing 메커니즘
- [ ] WebFlux 의 DispatcherHandler → HandlerMapping → HandlerAdapter 체인
- [ ] gateway 의 AuthenticationGatewayFilter 가 어떻게 reactive 하게 작성되는가

## 18. 다음 학습

- [09-netty-internals.md](09-netty-internals.md) — Netty 더 깊이
- [10-project-reactor.md](10-project-reactor.md) — Reactor 기본
- [11-backpressure.md](11-backpressure.md) — backpressure 심화
- [12-webflux-vs-mvc.md](12-webflux-vs-mvc.md) — WebFlux vs MVC trade-off
- [13-virtual-threads-impact.md](13-virtual-threads-impact.md) — VT 가 reactive 의 입지를 어떻게 바꾸나
- [15-msa-gateway-webflux.md](15-msa-gateway-webflux.md) — msa gateway 깊이

## 19. 참고 자료

- Reactor reference: https://projectreactor.io/docs/core/release/reference/
- Reactor Netty reference: https://projectreactor.io/docs/netty/release/reference/
- Netty user guide: https://netty.io/wiki/
- Spring WebFlux reference: https://docs.spring.io/spring-framework/reference/web/webflux.html
- Spring Cloud Gateway: https://docs.spring.io/spring-cloud-gateway/reference/
- Reactive Streams 1.0.4: https://www.reactive-streams.org/
- Netty in Action (Norman Maurer, 2015)
- "Hands-On Reactive Programming in Spring 5" (Oleh Dokuka, Igor Lozynskyi, 2018)
