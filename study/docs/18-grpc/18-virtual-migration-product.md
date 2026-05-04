---
parent: 18-grpc
seq: 18
title: 가상 마이그레이션 — order → product getById 의 gRPC 도입 시안
type: deep
created: 2026-05-01
---

# 18. 가상 마이그레이션 (POC 시안)

> ADR (Architecture Decision Record, 아키텍처 결정 기록) 작성을 위해 *작은 endpoint 하나* 를 끝까지 그려본다. `order → product.getById` 가 후보 (15-msa-hot-paths 에서 식별).

## 1. 현재 상태 (REST)

### 1-1. 클라이언트 측 — `order/app/src/main/kotlin/com/kgd/order/infrastructure/client/ProductAdapter.kt`

```kotlin
@Component
class ProductAdapter(
    @Qualifier("productWebClient") private val webClient: WebClient,
    private val circuitBreakerRegistry: CircuitBreakerRegistry,
) : ProductPort {

    private val circuitBreaker = circuitBreakerRegistry.circuitBreaker("product-service")

    override suspend fun validateProduct(productId: Long): ProductInfo {
        return circuitBreaker.executeSuspendFunction {
            try {
                val response = webClient.get()
                    .uri("/api/products/{id}", productId)
                    .retrieve()
                    .bodyToMono(ProductApiResponse::class.java)
                    .awaitSingle()
                response?.data?.toProductInfo()
                    ?: throw BusinessException(ErrorCode.NOT_FOUND, "...")
            } catch (e: WebClientResponseException.NotFound) {
                throw BusinessException(ErrorCode.NOT_FOUND, "...")
            } catch (e: Exception) {
                throw BusinessException(ErrorCode.EXTERNAL_API_ERROR, "...")
            }
        }
    }
}
```

### 1-2. 서버 측 — product 의 REST controller (가정)

```kotlin
@RestController
@RequestMapping("/api/products")
class ProductController(private val queryService: ProductQueryService) {
    @GetMapping("/{id}")
    fun getProduct(@PathVariable id: Long): ApiResponse<ProductResponse> {
        val product = queryService.findById(id)
            ?: throw BusinessException(ErrorCode.NOT_FOUND, "...")
        return ApiResponse.success(product.toResponse())
    }
}
```

### 1-3. 의존성 / 인프라

- WebClient (Reactor)
- Resilience4j CircuitBreaker
- Spring Boot Actuator + Micrometer
- Kubernetes ClusterIP service `product-service`

## 2. proto 정의 (신규)

### 2-1. `proto/src/main/proto/commerce/product/v1/product.proto`

```protobuf
syntax = "proto3";

package commerce.product.v1;

option java_package = "com.kgd.proto.commerce.product.v1";
option java_multiple_files = true;

import "google/protobuf/timestamp.proto";

message Product {
  int64 id = 1;
  string name = 2;
  int64 price_cents = 3;
  ProductStatus status = 4;
  int32 stock = 5;
  google.protobuf.Timestamp created_at = 6;
}

enum ProductStatus {
  PRODUCT_STATUS_UNSPECIFIED = 0;
  PRODUCT_STATUS_ACTIVE = 1;
  PRODUCT_STATUS_INACTIVE = 2;
  PRODUCT_STATUS_DELETED = 3;
}
```

### 2-2. `proto/src/main/proto/commerce/product/v1/product_service.proto`

```protobuf
syntax = "proto3";

package commerce.product.v1;

option java_package = "com.kgd.proto.commerce.product.v1";
option java_multiple_files = true;

import "commerce/product/v1/product.proto";

service ProductService {
  rpc GetProduct(GetProductRequest) returns (GetProductResponse);
}

message GetProductRequest {
  int64 id = 1;
}

message GetProductResponse {
  Product product = 1;
}
```

## 3. 모듈 / 빌드 변경

### 3-1. `proto/build.gradle.kts` (신규 모듈)

```kotlin
plugins {
    kotlin("jvm")
    id("com.google.protobuf") version "0.9.4"
}

dependencies {
    api("com.google.protobuf:protobuf-kotlin:3.25.3")
    api("io.grpc:grpc-protobuf:1.62.2")
    api("io.grpc:grpc-stub:1.62.2")
    api("io.grpc:grpc-kotlin-stub:1.4.1")
    api("io.grpc:grpc-netty-shaded:1.62.2")
}

protobuf {
    protoc { artifact = "com.google.protobuf:protoc:3.25.3" }
    plugins {
        id("grpc")   { artifact = "io.grpc:protoc-gen-grpc-java:1.62.2" }
        id("grpckt") { artifact = "io.grpc:protoc-gen-grpc-kotlin:1.4.1:jdk8@jar" }
    }
    generateProtoTasks {
        all().forEach {
            it.plugins { id("grpc"); id("grpckt") }
            it.builtins { id("kotlin") }
        }
    }
}
```

### 3-2. `settings.gradle.kts` 수정

```kotlin
include(":proto-commerce")
project(":proto-commerce").projectDir = file("proto")
```

### 3-3. `order/app/build.gradle.kts` 추가

```kotlin
dependencies {
    implementation(project(":proto-commerce"))
    implementation("net.devh:grpc-client-spring-boot-starter:3.1.0.RELEASE")
}
```

### 3-4. `product/app/build.gradle.kts` 추가

```kotlin
dependencies {
    implementation(project(":proto-commerce"))
    implementation("net.devh:grpc-server-spring-boot-starter:3.1.0.RELEASE")
}
```

## 4. 서버 측 구현 (product)

### 4-1. gRPC 서비스 핸들러

```kotlin
package com.kgd.product.infrastructure.grpc

import com.kgd.product.application.product.query.ProductQueryService
import com.kgd.proto.commerce.product.v1.GetProductRequest
import com.kgd.proto.commerce.product.v1.GetProductResponse
import com.kgd.proto.commerce.product.v1.ProductServiceGrpcKt
import com.kgd.proto.commerce.product.v1.getProductResponse
import com.kgd.proto.commerce.product.v1.product
import com.kgd.proto.commerce.product.v1.ProductStatus as ProtoStatus
import io.grpc.Status
import io.grpc.StatusException
import net.devh.boot.grpc.server.service.GrpcService

@GrpcService
class ProductGrpcService(
    private val queryService: ProductQueryService,
) : ProductServiceGrpcKt.ProductServiceCoroutineImplBase() {

    override suspend fun getProduct(request: GetProductRequest): GetProductResponse {
        val product = queryService.findById(request.id)
            ?: throw StatusException(
                Status.NOT_FOUND.withDescription("product ${request.id} not found")
            )

        return getProductResponse {
            this.product = product {
                id = product.id
                name = product.name
                priceCents = product.priceCents
                status = product.status.toProto()
                stock = product.stock
                createdAt = product.createdAt.toProtoTimestamp()
            }
        }
    }
}

fun ProductDomainStatus.toProto(): ProtoStatus = when (this) {
    ProductDomainStatus.ACTIVE -> ProtoStatus.PRODUCT_STATUS_ACTIVE
    ProductDomainStatus.INACTIVE -> ProtoStatus.PRODUCT_STATUS_INACTIVE
    ProductDomainStatus.DELETED -> ProtoStatus.PRODUCT_STATUS_DELETED
}
```

### 4-2. application.yml (서버)

```yaml
grpc:
  server:
    port: 9090
    enable-keep-alive: true
    keep-alive-time: 30s
```

### 4-3. K8s Service (헤드리스 추가)

```yaml
apiVersion: v1
kind: Service
metadata:
  name: product-grpc
  labels:
    app: product
spec:
  clusterIP: None       # headless
  ports:
    - name: grpc
      port: 9090
      targetPort: 9090
  selector:
    app: product
```

(기존 `product-service` REST service 와 별도 — 점진 운영을 위해 양립)

## 5. 클라이언트 측 — 새 ProductGrpcAdapter

```kotlin
package com.kgd.order.infrastructure.client

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.order.application.order.port.ProductInfo
import com.kgd.order.application.order.port.ProductPort
import com.kgd.proto.commerce.product.v1.ProductServiceGrpcKt
import com.kgd.proto.commerce.product.v1.getProductRequest
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry
import io.github.resilience4j.kotlin.circuitbreaker.executeSuspendFunction
import io.grpc.Status
import io.grpc.StatusException
import net.devh.boot.grpc.client.inject.GrpcClient
import org.slf4j.LoggerFactory
import org.springframework.context.annotation.Profile
import org.springframework.stereotype.Component
import java.math.BigDecimal
import java.util.concurrent.TimeUnit

@Component
@Profile("grpc")     // 토글: 'grpc' 프로파일에서만 활성
class ProductGrpcAdapter(
    private val circuitBreakerRegistry: CircuitBreakerRegistry,
) : ProductPort {

    private val log = LoggerFactory.getLogger(javaClass)
    private val circuitBreaker = circuitBreakerRegistry.circuitBreaker("product-service")

    @GrpcClient("product-grpc")
    private lateinit var stub: ProductServiceGrpcKt.ProductServiceCoroutineStub

    override suspend fun validateProduct(productId: Long): ProductInfo {
        return circuitBreaker.executeSuspendFunction {
            try {
                val resp = stub
                    .withDeadlineAfter(500, TimeUnit.MILLISECONDS)
                    .getProduct(getProductRequest { id = productId })

                val p = resp.product
                ProductInfo(
                    productId = p.id,
                    name = p.name,
                    price = BigDecimal.valueOf(p.priceCents).movePointLeft(2),
                    status = p.status.name.removePrefix("PRODUCT_STATUS_"),
                    stock = p.stock,
                )
            } catch (e: StatusException) {
                when (e.status.code) {
                    Status.Code.NOT_FOUND ->
                        throw BusinessException(ErrorCode.NOT_FOUND, "상품 없음: $productId")
                    Status.Code.DEADLINE_EXCEEDED ->
                        throw BusinessException(ErrorCode.EXTERNAL_API_ERROR, "product timeout")
                    Status.Code.UNAVAILABLE ->
                        throw BusinessException(ErrorCode.EXTERNAL_API_ERROR, "product 일시 중단")
                    else -> {
                        log.error("gRPC product 호출 실패: id={} status={}", productId, e.status, e)
                        throw BusinessException(
                            ErrorCode.EXTERNAL_API_ERROR,
                            "product gRPC ${e.status.code}: ${e.message}"
                        )
                    }
                }
            }
        }
    }
}
```

## 6. application.yml — 클라 측 channel 설정

```yaml
spring:
  profiles:
    active: ${SPRING_PROFILES_ACTIVE:default}

grpc:
  client:
    product-grpc:
      address: 'static://product-grpc.default.svc.cluster.local:9090'
      negotiation-type: PLAINTEXT
      enable-keep-alive: true
      keep-alive-time: 30s
      keep-alive-without-calls: true
```

또는 K8s DNS 기반:

```yaml
grpc:
  client:
    product-grpc:
      address: 'dns:///product-grpc.default.svc.cluster.local:9090'
      defaultLoadBalancingPolicy: round_robin
```

## 7. 양립 운영 (toggle)

### 7-1. profile 기반

- 기본 (`default`): REST `ProductAdapter` 활성, `@Primary` 또는 단일 빈
- 실험 (`grpc`): `ProductGrpcAdapter` 활성

```kotlin
@Component
@Profile("default", "rest")    // 기본 / rest 토글에서 활성
class ProductRestAdapter(...) : ProductPort { ... }

@Component
@Profile("grpc")
class ProductGrpcAdapter(...) : ProductPort { ... }
```

### 7-2. canary

- K8s deployment 의 일부 pod 만 `grpc` profile
- 메트릭으로 비교 후 점진 확산

## 8. 측정 / 메트릭

### 8-1. server 측

`grpc-spring-boot-starter` + Micrometer 자동 노출:

```
grpc_server_handled_total{grpc_method="GetProduct", grpc_status="OK"} 1234
grpc_server_handling_seconds_bucket{...}
```

Prometheus + Grafana 패널:
- P50 / P99 latency
- 요청율 (RPS)
- 에러율 (`grpc_status != OK`)

### 8-2. client 측

```
grpc_client_completed_total{grpc_method="GetProduct"}
grpc_client_completed_seconds_bucket{...}
```

비교 패널: REST `http_server_requests_seconds` vs gRPC `grpc_server_handling_seconds` 같은 시간대.

### 8-3. 측정 항목 (POC 목표)

| 메트릭 | 기대값 |
|---|---|
| P50 latency | -10 ~ -30% |
| P99 latency | -5 ~ -20% |
| 페이로드 크기 (응답) | -50 ~ -70% |
| RPS 처리량 | +0 ~ +10% (CPU bound 아니면 변화 작음) |
| 메모리 (heap) | ±0 (Netty 추가로 +10MB) |
| 빌드 시간 | +5-10s (proto 생성) |

## 9. 롤백 전략

- profile 토글로 즉시 REST 복귀
- 양립 운영 중 metrics 이상 감지 → `grpc` profile pod 종료
- proto 변경이 issue 면 git revert (호환 깨짐 없으면 단순)

## 10. 다음 단계 (확산)

- POC 결과 OK → `getProduct` REST 폐기 (양립 운영 1-2주 후)
- product 의 다른 RPC (`listProducts`, `searchProducts` ) 추가
- Buf lint / breaking CI 통합
- order 외 다른 호출자 (search-batch) 도 gRPC 도입

## 11. 의존성 / 인프라 영향 요약

| 영역 | 변경 |
|---|---|
| Gradle 모듈 | `:proto-commerce` 신설 |
| 빌드 시간 | +5-10s/서비스 (proto 생성) |
| 서비스 jar | +10-15MB (Netty + protobuf) |
| K8s | headless service `product-grpc` 추가, deployment containerPort 9090 추가 |
| 모니터링 | gRPC 메트릭 panel 추가 |
| CI | (Phase 1 부터) Buf lint / breaking |
| 학습 | proto 작성, gRPC stub, Status 변환 |

## 12. 면접 핵심

> Q: gRPC 도입 시 양립 운영은 어떻게?

A: REST `ProductAdapter` 와 gRPC `ProductGrpcAdapter` 를 같은 `ProductPort` 인터페이스로 구현. profile (`@Profile("rest")` / `@Profile("grpc")`) 또는 feature flag 로 빈 활성 분기. K8s 는 별도 service / port 로 양립 운영. 메트릭 비교 후 점진 폐기.

> Q: 클라이언트 LB 는 어떻게 설정?

A: `dns:///product-grpc.svc.cluster.local:9090` + `defaultLoadBalancingPolicy: round_robin` + headless service. ClusterIP service 는 multiplexing 으로 한 pod 만 받으므로 부적합. Istio 가 있으면 sidecar 위임 가능.

> Q: 인증은?

A: Phase 0 (POC) = h2c (no TLS), NetworkPolicy 로 격리. Phase 1 = JWT (JSON Web Token) metadata propagation (gateway 가 검증 → metadata 로 user_id 전파). Phase 2 (mesh) = mTLS (mutual TLS, 양방향 TLS) 자동.

## 다음 학습

- [19-improvements.md](19-improvements.md) — 본 시안을 바탕으로 한 ADR 초안
- [20-interview-qa.md](20-interview-qa.md) — 회독용
