---
parent: 18-grpc
seq: 05
title: 코드 생성 + stub (blocking / async / coroutine / reactive)
type: deep
created: 2026-05-01
---

# 05. 코드 생성 + stub

## 1. 코드 생성 파이프라인

```
.proto 파일
    │
    │  protoc + 플러그인
    ▼
[ Java/Kotlin DTO 클래스 ]   ←  protobuf-java / protobuf-kotlin
[ gRPC 서비스 stub 클래스 ]   ←  grpc-java / grpc-kotlin
    │
    ▼
빌드 시스템 (Gradle / Maven) 의 sourceSet 에 자동 포함
```

핵심 도구:
- **protoc** — Google 의 공식 컴파일러 (C++ 바이너리). 언어별 플러그인을 받아 코드 생성
- **protoc-gen-grpc-java** / **protoc-gen-grpc-kotlin** — gRPC 서비스 stub 생성 플러그인
- **Buf** — `protoc` 대체 도구 (lint, breaking detection, BSR 통합) — [08 참조](08-schema-evolution.md)

## 2. Gradle 통합 (`protobuf-gradle-plugin`)

```kotlin
// build.gradle.kts
import com.google.protobuf.gradle.id

plugins {
    kotlin("jvm")
    id("com.google.protobuf") version "0.9.4"
}

dependencies {
    // Protobuf
    implementation("com.google.protobuf:protobuf-kotlin:3.25.3")
    implementation("com.google.protobuf:protobuf-java-util:3.25.3")  // JSON util

    // gRPC core
    implementation("io.grpc:grpc-protobuf:1.62.2")
    implementation("io.grpc:grpc-stub:1.62.2")
    implementation("io.grpc:grpc-netty-shaded:1.62.2")  // 또는 grpc-netty

    // Kotlin coroutine stub
    implementation("io.grpc:grpc-kotlin-stub:1.4.1")

    // 서버 측 Spring Boot 통합 (선택)
    implementation("net.devh:grpc-server-spring-boot-starter:3.1.0.RELEASE")
    implementation("net.devh:grpc-client-spring-boot-starter:3.1.0.RELEASE")
}

protobuf {
    protoc { artifact = "com.google.protobuf:protoc:3.25.3" }
    plugins {
        id("grpc") {
            artifact = "io.grpc:protoc-gen-grpc-java:1.62.2"
        }
        id("grpckt") {
            artifact = "io.grpc:protoc-gen-grpc-kotlin:1.4.1:jdk8@jar"
        }
    }
    generateProtoTasks {
        all().forEach {
            it.plugins {
                id("grpc")    // Java stub
                id("grpckt")  // Kotlin coroutine stub
            }
            it.builtins {
                id("kotlin")  // Kotlin DSL builders
            }
        }
    }
}

sourceSets {
    main {
        java.srcDirs("build/generated/source/proto/main/java", "build/generated/source/proto/main/grpc")
        kotlin.srcDirs("build/generated/source/proto/main/kotlin", "build/generated/source/proto/main/grpckt")
    }
}
```

빌드 산출물:
```
build/generated/source/proto/main/
  ├── java/        ← Protobuf 메시지 (Java)
  ├── kotlin/      ← Kotlin DSL builder
  ├── grpc/        ← gRPC stub (Java, Future / Stream observer)
  └── grpckt/      ← gRPC stub (Kotlin, suspend / Flow)
```

## 3. 생성되는 stub 종류

`ProductService` 가 정의된 .proto 로부터 protoc 가 만드는 4종 stub:

| stub | 메서드 시그니처 | 사용 시점 |
|---|---|---|
| **Blocking** | `getProduct(req): Resp` | 단순 동기, 테스트, 짧은 RPC |
| **Async (callback)** | `getProduct(req, StreamObserver<Resp>)` | 비동기, callback hell |
| **ListenableFuture** | `getProduct(req): ListenableFuture<Resp>` | Guava future, 합성 |
| **Coroutine (Kotlin)** | `suspend fun getProduct(req): Resp` | Kotlin coroutine, 가장 깔끔 |

### 3.1 Blocking stub (Java/Kotlin 공통)

```kotlin
val channel = ManagedChannelBuilder
    .forAddress("product-service", 9090)
    .usePlaintext()
    .build()

val blockingStub = ProductServiceGrpc.newBlockingStub(channel)
    .withDeadlineAfter(500, TimeUnit.MILLISECONDS)

val resp: GetProductResponse = blockingStub.getProduct(
    GetProductRequest.newBuilder().setId(123).build()
)
```

- 호출 thread 가 응답까지 block
- 서버 streaming 은 `Iterator<Resp>` 반환
- Spring 의 `@RestController` 같은 thread-pool 모델에 적합

### 3.2 Async stub (callback)

```kotlin
val asyncStub = ProductServiceGrpc.newStub(channel)

asyncStub.getProduct(
    GetProductRequest.newBuilder().setId(123).build(),
    object : StreamObserver<GetProductResponse> {
        override fun onNext(resp: GetProductResponse) { /* ... */ }
        override fun onError(t: Throwable) { /* ... */ }
        override fun onCompleted() { /* ... */ }
    }
)
```

- non-blocking
- 4 패턴 모두 지원
- callback 합성이 까다로움 → ListenableFuture / Coroutine 권장

### 3.3 ListenableFuture stub

```kotlin
val futureStub = ProductServiceGrpc.newFutureStub(channel)
val future: ListenableFuture<GetProductResponse> = futureStub.getProduct(req)
Futures.transform(future, Function { it.product }, executor)
```

- Unary 만 지원 (streaming 은 의미 없음)
- Java CompletableFuture 어댑터 가능

### 3.4 Coroutine stub (Kotlin) — **권장**

```kotlin
val coroutineStub = ProductServiceGrpcKt.ProductServiceCoroutineStub(channel)
    .withDeadlineAfter(500, TimeUnit.MILLISECONDS)

suspend fun fetchProduct(id: Long): Product {
    val resp = coroutineStub.getProduct(
        getProductRequest { this.id = id }   // Kotlin DSL
    )
    return resp.product
}

// Server-streaming
suspend fun searchProducts(q: String) {
    coroutineStub.searchProducts(searchRequest { query = q })
        .collect { product -> log.info("hit: {}", product.id) }
}

// Client-streaming
suspend fun upload(events: Flow<MetricEvent>): UploadAck =
    coroutineStub.uploadMetrics(events)

// Bidi
fun chat(outgoing: Flow<ChatMessage>): Flow<ChatMessage> =
    coroutineStub.chat(outgoing)
```

- `suspend fun` (Unary, Client-streaming) + `Flow<T>` (Server-streaming, Bidi)
- coroutine cancellation 이 자동으로 gRPC RST_STREAM 으로 전파
- **msa 의 WebClient + reactor 코드와 자연스럽게 호환**

### 3.5 Reactive stub (별도 라이브러리)

```kotlin
// salesforce/reactive-grpc — reactor / RxJava 변환
val reactorStub = ReactorProductServiceGrpc.newReactorStub(channel)
val mono: Mono<GetProductResponse> = reactorStub.getProduct(reqMono)
```

- 공식 gRPC-Java 에는 없음 (커뮤니티)
- Project Reactor / RxJava 와 자연스럽게 통합
- coroutine 이 없는 Java 환경에서 유용

## 4. 서버 측 구현

### 4.1 Plain gRPC server

```kotlin
class ProductServiceImpl : ProductServiceGrpcKt.ProductServiceCoroutineImplBase() {
    override suspend fun getProduct(request: GetProductRequest): GetProductResponse {
        val product = productRepository.findById(request.id)
            ?: throw StatusException(Status.NOT_FOUND.withDescription("product ${request.id}"))
        return getProductResponse { this.product = product.toProto() }
    }

    override fun searchProducts(request: SearchRequest): Flow<Product> = flow {
        productRepository.search(request.query).collect { p -> emit(p.toProto()) }
    }
}

fun main() {
    val server = ServerBuilder.forPort(9090)
        .addService(ProductServiceImpl())
        .intercept(LoggingInterceptor())
        .build()
        .start()
    server.awaitTermination()
}
```

### 4.2 Spring Boot 통합 (`grpc-spring-boot-starter`)

```kotlin
@GrpcService                         // 서버 등록 자동
class ProductGrpcService(
    private val productQueryService: ProductQueryService,
) : ProductServiceGrpcKt.ProductServiceCoroutineImplBase() {

    override suspend fun getProduct(request: GetProductRequest): GetProductResponse {
        val product = productQueryService.findById(request.id)
        return getProductResponse { this.product = product.toProto() }
    }
}

// 클라이언트 측
@Component
class ProductClient {
    @GrpcClient("product-service")   // application.yml 의 채널 설정 참조
    private lateinit var stub: ProductServiceGrpcKt.ProductServiceCoroutineStub

    suspend fun getProduct(id: Long): Product = stub.getProduct(getProductRequest { this.id = id }).product
}
```

```yaml
# application.yml
grpc:
  server:
    port: 9090
    enable-keep-alive: true
    keep-alive-time: 30s
  client:
    product-service:
      address: 'discovery:///product-service'   # K8s DNS 또는 Eureka
      negotiation-type: PLAINTEXT  # 내부망. 외부면 TLS
      enable-keep-alive: true
```

## 5. Kotlin DSL builder

protobuf 3.20+ 의 `protobuf-kotlin` 은 DSL 빌더를 생성한다.

```kotlin
// 기존 Java builder
val req = GetProductRequest.newBuilder()
    .setId(123)
    .setIncludeDeleted(false)
    .build()

// Kotlin DSL
val req = getProductRequest {
    id = 123
    includeDeleted = false
}

// nested + repeated
val order = order {
    id = 100
    items += orderItem { productId = 1; quantity = 2 }
    items += orderItem { productId = 5; quantity = 1 }
}
```

→ 가독성/안정성 모두 향상. msa 의 Kotlin convention 과 일치.

## 6. 빌드 산출물 공유 전략

여러 서비스가 같은 proto 를 쓸 때:

### 옵션 A: 각 서비스 build.gradle 에 proto 의존성 + 자체 코드 생성
- 장점: 단순, IDE friendly
- 단점: 빌드 시간 ↑, 동일 코드 중복

### 옵션 B: proto-only 모듈 (jar 배포)
```
:proto-commerce  →  proto + 생성 코드 → jar
:order:app       →  implementation(":proto-commerce")
:product:app     →  implementation(":proto-commerce")
```
- 장점: 빌드 캐시, 단일 진실
- 단점: proto 변경 시 모든 의존 모듈 재빌드

### 옵션 C: BSR (Buf Schema Registry) + 외부 jar
- 옵션 B 의 분산 버전 — proto 변경 → BSR 게시 → 의존 모듈은 버전 pin
- 장점: 강한 schema 거버넌스 (lint, breaking detection)
- 단점: 외부 의존성, 학습 비용

→ msa 의 monorepo 전략과 결합 = **옵션 B + Buf 로컬 lint** 가 균형점. [17 참조](17-proto-monorepo-strategy.md).

## 7. 흔한 빌드 트러블

| 증상 | 원인 / 해결 |
|---|---|
| `protoc-gen-grpc-kotlin` not found | 플러그인 artifact 누락, classifier `:jdk8@jar` 확인 |
| import "google/protobuf/timestamp.proto" 못 찾음 | `protobuf-java` dependency 빠짐 (well-known proto 가 jar 내부) |
| 생성 코드를 IDE 가 못 찾음 | sourceSets 에 build/generated/source/proto 추가 |
| `INTERNAL: HTTP/2 error code: NO_ERROR` | 서버 측 코드에서 throw 가 Status 로 안 wrapping 됨 |
| Kotlin coroutine stub 이 `suspend` 가 아님 | `protoc-gen-grpc-kotlin` 플러그인 적용 누락 (java-only 만 됨) |
| 직렬화 OOM | 큰 메시지 → `maxInboundMessageSize(...)` 조정 |

## 8. 의존성 버전 매트릭스 (2026-05 기준 권장)

| 라이브러리 | 권장 버전 | 비고 |
|---|---|---|
| protobuf-java / kotlin | 3.25.x | 4.x (편집판) 는 아직 ecosystem 호환 작업 중 |
| grpc-java | 1.62+ | LTS 채널 사용 권장 |
| grpc-kotlin | 1.4.x | grpc-java 1.62 와 호환 |
| protobuf-gradle-plugin | 0.9.4 | |
| grpc-spring-boot-starter | 3.1.x | net.devh, Spring Boot 3.x 호환 |
| Buf CLI | 1.30+ | lint + breaking |

## 9. msa 도입 시 빌드 영향

- gradle 빌드 시간: proto 생성 단계 추가 → +5-10s (서비스당)
- 결과 jar: protobuf-java + grpc-netty-shaded → +~10MB (Netty)
- Spring Boot fat jar 와 충돌: `grpc-netty-shaded` (Netty 충돌 회피용 shaded 버전) 권장
- gRPC 서버는 별도 포트 (9090) 가 일반적 → K8s (Kubernetes) Service 는 두 포트 노출 (8080 REST, 9090 gRPC)

## 다음 학습

- [06-http2-deep-dive.md](06-http2-deep-dive.md) — stub 아래 transport 동작 이해
- [09-advanced-features.md](09-advanced-features.md) — Deadline / Interceptor 활용
- [17-proto-monorepo-strategy.md](17-proto-monorepo-strategy.md) — proto 공유 전략 심화
