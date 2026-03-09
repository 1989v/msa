# Search Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 검색 서비스에 `search:consumer`(증분 색인), `search:batch`(전체 색인) 모듈을 추가하고 BulkIngester 기반 ES 파이프라인을 완성한다.

**Architecture:**
- `search:app` — 읽기 전용 REST 검색 API (write 책임 제거)
- `search:consumer` — Kafka 이벤트 수신 → BulkIngester 비동기 증분 색인
- `search:batch` — Spring Batch + WebClient(product:app) → BulkIngester → alias swap 전체 색인
- 두 모듈 모두 동일한 Dual BulkIngester 패턴 사용 (primary 5s/1000건 + retry 3s/500건)

**Tech Stack:** Kotlin, Spring Boot 4.0.3, elasticsearch-java BulkIngester, Spring Batch 5, Spring Data Elasticsearch, Apache Kafka, WebClient, Kotest BehaviorSpec, MockK

---

## 레퍼런스 패턴 요약

### BulkIngester (mrt-mypack 패턴)
- `BulkIngester.of { client / maxOperations / flushInterval / listener }` 로 설정
- **Dual Ingester**: primary(5s/1000건) → 실패 시 retry(3s/500건)
- `@PostConstruct`로 초기화, `DisposableBean.destroy()`로 `close()` 호출
- `processDocument(indexName, document)`: Map으로 변환 후 비동기 add
- `flush()`: batch 완료 후 호출하여 잔여 작업 강제 전송

### Index Alias Pattern (mrt-mypack 패턴)
- 새 색인: `products_20260309120000` (타임스탬프 접미사)
- 전체 색인 완료 후 alias `products` → 새 색인으로 교체
- 이전 색인 최대 2개 보관 후 삭제 (zero-downtime)

---

## Task 1: product:app — 상품 목록 조회 API 추가

> `search:batch` 가 product:app 에서 전체 상품을 페이지네이션으로 가져올 수 있어야 함

**Files:**
- Modify: `product/app/src/main/kotlin/com/kgd/product/application/product/usecase/GetProductUseCase.kt`
- Modify: `product/app/src/main/kotlin/com/kgd/product/application/product/service/ProductTransactionalService.kt`
- Modify: `product/app/src/main/kotlin/com/kgd/product/application/product/service/ProductService.kt`
- Modify: `product/app/src/main/kotlin/com/kgd/product/presentation/product/controller/ProductController.kt`
- Modify: `product/app/src/main/kotlin/com/kgd/product/presentation/product/dto/ProductResponse.kt` (있으면)
- Modify: `product/app/src/test/kotlin/com/kgd/product/application/product/service/ProductServiceTest.kt`

**Step 1: `GetProductUseCase`에 `GetAll` 중첩 인터페이스 추가**

```kotlin
// 기존 파일에 추가 (GetById 아래에)
interface GetAllProductsUseCase {
    fun execute(query: Query): Result
    data class Query(val page: Int, val size: Int)
    data class Result(
        val products: List<ProductResult>,
        val totalElements: Long,
        val totalPages: Int
    )
}
```

**Step 2: `ProductTransactionalService.findAll` 이미 있는지 확인, 없으면 추가**

```kotlin
@Transactional(readOnly = true)
fun findAll(pageable: Pageable): Page<Product> = productRepository.findAll(pageable)
```

**Step 3: `ProductService`에 `GetAllProductsUseCase` 구현 추가**

```kotlin
@Service
class ProductService(
    private val transactionalService: ProductTransactionalService,
    private val eventPort: ProductEventPort
) : CreateProductUseCase, GetProductUseCase, UpdateProductUseCase, GetAllProductsUseCase {

    override fun execute(query: GetAllProductsUseCase.Query): GetAllProductsUseCase.Result {
        val pageable = PageRequest.of(query.page, query.size, Sort.by("id").ascending())
        val page = transactionalService.findAll(pageable)
        return GetAllProductsUseCase.Result(
            products = page.content.map { product ->
                GetAllProductsUseCase.Result.ProductResult(
                    id = requireNotNull(product.id),
                    name = product.name,
                    price = product.price.amount,
                    status = product.status.name,
                    stock = product.stock
                )
            },
            totalElements = page.totalElements,
            totalPages = page.totalPages
        )
    }
}
```

`GetAllProductsUseCase.Result.ProductResult` 정의 (위 Result 내부에):
```kotlin
data class ProductResult(
    val id: Long,
    val name: String,
    val price: java.math.BigDecimal,
    val status: String,
    val stock: Int
)
```

**Step 4: `ProductController`에 목록 조회 엔드포인트 추가**

```kotlin
@GetMapping
fun getProducts(
    @RequestParam(defaultValue = "0") page: Int,
    @RequestParam(defaultValue = "100") @Max(500) size: Int
): ResponseEntity<ApiResponse<GetAllProductsUseCase.Result>> {
    val result = getAllProductsUseCase.execute(GetAllProductsUseCase.Query(page, size))
    return ResponseEntity.ok(ApiResponse.success(result))
}
```

(Controller 생성자에 `getAllProductsUseCase: GetAllProductsUseCase` 추가)

**Step 5: 테스트 추가 — `ProductServiceTest`에 `GetAllProductsUseCase` 시나리오**

```kotlin
given("상품 목록 조회 시") {
    `when`("유효한 페이지 파라미터가 주어지면") {
        then("페이지네이션된 상품 목록을 반환해야 한다") {
            every { transactionalService.findAll(any()) } returns PageImpl(
                listOf(product), PageRequest.of(0, 100), 1L
            )
            val result = productService.execute(GetAllProductsUseCase.Query(0, 100))
            result.products shouldHaveSize 1
            result.totalElements shouldBe 1L
        }
    }
}
```

**Step 6: 빌드 확인**
```bash
./gradlew :product:app:build
```

**Step 7: 커밋**
```bash
git add product/
git commit -m "feat(product): add GET /api/products paginated list endpoint"
```

---

## Task 2: search:consumer — Gradle 모듈 생성 + EsBulkDocumentProcessor

**Files:**
- Create: `search/consumer/build.gradle.kts`
- Create: `search/consumer/src/main/kotlin/com/kgd/search/SearchConsumerApplication.kt`
- Create: `search/consumer/src/main/kotlin/com/kgd/search/infrastructure/config/ElasticsearchClientConfig.kt`
- Create: `search/consumer/src/main/kotlin/com/kgd/search/infrastructure/indexing/EsBulkDocumentProcessor.kt`
- Create: `search/consumer/src/test/kotlin/com/kgd/search/infrastructure/indexing/EsBulkDocumentProcessorTest.kt`

**Step 1: `search/consumer/build.gradle.kts` 생성**

```kotlin
plugins {
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.spring.boot)
}

dependencies {
    implementation(project(":search:domain"))
    implementation(project(":common"))
    implementation(libs.spring.boot.starter.actuator)
    implementation(libs.spring.boot.starter.data.elasticsearch)
    implementation(libs.spring.cloud.eureka.client)
    implementation(libs.spring.kafka)
    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.kotest.extensions.spring)
}

tasks.bootJar {
    archiveBaseName.set("search-consumer")
}
```

**Step 2: `SearchConsumerApplication.kt` 생성**

```kotlin
package com.kgd.search

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication
class SearchConsumerApplication

fun main(args: Array<String>) {
    runApplication<SearchConsumerApplication>(*args)
}
```

**Step 3: `ElasticsearchClientConfig.kt` 생성**

Spring Boot auto-configures `ElasticsearchClient` via `spring-boot-starter-data-elasticsearch`.
커스텀 설정 없이 `application.yml`의 `spring.elasticsearch.uris`를 사용.

```kotlin
package com.kgd.search.infrastructure.config

import org.springframework.context.annotation.Configuration
import org.springframework.data.elasticsearch.client.ClientConfiguration
import org.springframework.data.elasticsearch.client.elc.ElasticsearchConfiguration

@Configuration
class ElasticsearchClientConfig : ElasticsearchConfiguration() {

    // spring.elasticsearch.uris 를 통해 자동 설정됨
    // ElasticsearchClient bean은 Spring Boot auto-config이 제공
    override fun clientConfiguration(): ClientConfiguration =
        ClientConfiguration.builder()
            .connectedTo(
                System.getenv("ELASTICSEARCH_URIS")
                    ?.removePrefix("http://")?.removePrefix("https://")
                    ?: "localhost:9200"
            )
            .build()
}
```

**Step 4: `EsBulkDocumentProcessor.kt` 생성 (핵심 컴포넌트)**

```kotlin
package com.kgd.search.infrastructure.indexing

import co.elastic.clients.elasticsearch.ElasticsearchClient
import co.elastic.clients.elasticsearch.core.BulkRequest
import co.elastic.clients.elasticsearch.core.BulkResponse
import co.elastic.clients.elasticsearch.core.bulk.BulkOperation
import co.elastic.clients.elasticsearch._helpers.bulk.BulkIngester
import co.elastic.clients.elasticsearch._helpers.bulk.BulkListener
import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.search.domain.product.model.ProductDocument
import jakarta.annotation.PostConstruct
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.DisposableBean
import org.springframework.stereotype.Component
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong

@Component
class EsBulkDocumentProcessor(
    private val esClient: ElasticsearchClient,
    private val objectMapper: ObjectMapper
) : DisposableBean {

    private val log = LoggerFactory.getLogger(javaClass)

    val processedCount = AtomicLong(0)
    val errorCount = AtomicLong(0)

    private lateinit var primaryIngester: BulkIngester<Void>
    private lateinit var retryIngester: BulkIngester<Void>

    @PostConstruct
    fun init() {
        retryIngester = BulkIngester.of { b ->
            b.client(esClient)
             .maxOperations(500)
             .flushInterval(3, TimeUnit.SECONDS)
             .listener(retryListener())
        }
        primaryIngester = BulkIngester.of { b ->
            b.client(esClient)
             .maxOperations(1000)
             .flushInterval(5, TimeUnit.SECONDS)
             .listener(primaryListener())
        }
    }

    fun processDocument(indexName: String, document: ProductDocument) {
        @Suppress("UNCHECKED_CAST")
        val docMap = objectMapper.convertValue(document, Map::class.java) as Map<String, Any?>
        primaryIngester.add(
            BulkOperation.of { op ->
                op.index { idx ->
                    idx.index(indexName).id(document.id).document(docMap)
                }
            }
        )
    }

    fun flush() {
        primaryIngester.flush()
    }

    private fun primaryListener() = object : BulkListener<Void> {
        override fun beforeBulk(executionId: Long, request: BulkRequest, contexts: MutableList<Void?>) {
            log.debug("Sending bulk: {} operations", request.operations().size)
        }

        override fun afterBulk(executionId: Long, request: BulkRequest, contexts: MutableList<Void?>, response: BulkResponse) {
            val failedOps = response.items().mapIndexedNotNull { idx, item ->
                if (item.error() != null) Pair(idx, item) else null
            }
            if (failedOps.isNotEmpty()) {
                log.error("{} items failed in bulk — sending to retry ingester", failedOps.size)
                failedOps.forEach { (idx, item) ->
                    log.error("Failed item: reason={}", item.error()?.reason())
                    retryIngester.add(request.operations()[idx])
                }
                errorCount.addAndGet(failedOps.size.toLong())
            }
            processedCount.addAndGet((response.items().size - failedOps.size).toLong())
        }

        override fun afterBulk(executionId: Long, request: BulkRequest, contexts: MutableList<Void?>, failure: Throwable) {
            log.error("Bulk request failed entirely: {}", failure.message, failure)
            errorCount.addAndGet(request.operations().size.toLong())
        }
    }

    private fun retryListener() = object : BulkListener<Void> {
        override fun beforeBulk(executionId: Long, request: BulkRequest, contexts: MutableList<Void?>) {}

        override fun afterBulk(executionId: Long, request: BulkRequest, contexts: MutableList<Void?>, response: BulkResponse) {
            val failed = response.items().count { it.error() != null }
            if (failed > 0) log.error("Retry still failed: {} items", failed)
            else log.info("Retry succeeded: {} items", response.items().size)
        }

        override fun afterBulk(executionId: Long, request: BulkRequest, contexts: MutableList<Void?>, failure: Throwable) {
            log.error("Retry bulk request failed: {}", failure.message, failure)
        }
    }

    override fun destroy() {
        primaryIngester.close()
        retryIngester.close()
    }
}
```

**Step 5: `EsBulkDocumentProcessorTest.kt` 작성 (실패 확인)**

```kotlin
class EsBulkDocumentProcessorTest : BehaviorSpec({
    val esClient = mockk<ElasticsearchClient>(relaxed = true)
    val objectMapper = ObjectMapper()

    // BulkIngester는 실 ES client 없이 단위 테스트 어려움 → 프로세서 로직만 검증
    given("EsBulkDocumentProcessor 가 초기화될 때") {
        `when`("processDocument 가 호출되면") {
            then("errorCount 는 0, processedCount 는 0 이어야 한다 (비동기 처리 전)") {
                val processor = EsBulkDocumentProcessor(esClient, objectMapper)
                processor.init()
                processor.processedCount.get() shouldBe 0
                processor.errorCount.get() shouldBe 0
                processor.destroy()
            }
        }
    }
})
```

> 참고: BulkIngester는 실 ES 서버가 필요한 통합 테스트 영역. 단위 테스트는 카운터 초기값 및 생명주기만 검증.

**Step 6: 빌드 확인 (`settings.gradle.kts` 에 아직 추가 전이므로 Task 7에서 통합)**

---

## Task 3: search:consumer — ProductIndexingConsumer + Kafka config + tests

**Files:**
- Create: `search/consumer/src/main/kotlin/com/kgd/search/infrastructure/messaging/ProductIndexEvent.kt`
- Create: `search/consumer/src/main/kotlin/com/kgd/search/infrastructure/messaging/ProductIndexingConsumer.kt`
- Create: `search/consumer/src/main/kotlin/com/kgd/search/infrastructure/config/KafkaConsumerConfig.kt`
- Create: `search/consumer/src/main/resources/application.yml`
- Create: `search/consumer/src/test/kotlin/com/kgd/search/infrastructure/messaging/ProductIndexingConsumerTest.kt`

**Step 1: `ProductIndexEvent.kt`**

```kotlin
package com.kgd.search.infrastructure.messaging

import java.math.BigDecimal
import java.time.LocalDateTime

data class ProductIndexEvent(
    val productId: Long,
    val name: String,
    val price: BigDecimal,
    val status: String,
    val eventTime: LocalDateTime
)
```

**Step 2: `ProductIndexingConsumer.kt` — BulkIngester 기반으로 변경**

```kotlin
package com.kgd.search.infrastructure.messaging

import com.kgd.search.domain.product.model.ProductDocument
import com.kgd.search.infrastructure.indexing.EsBulkDocumentProcessor
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component

@Component
class ProductIndexingConsumer(
    private val bulkProcessor: EsBulkDocumentProcessor
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @Value("\${search.index.alias:products}")
    private lateinit var indexAlias: String

    @KafkaListener(
        topics = ["product.item.created", "product.item.updated"],
        groupId = "\${kafka.consumer.group-id}",
        containerFactory = "productEventListenerContainerFactory"
    )
    fun consume(event: ProductIndexEvent) {
        log.info("Received product event: productId={}", event.productId)
        try {
            bulkProcessor.processDocument(
                indexAlias,
                ProductDocument(
                    id = event.productId.toString(),
                    name = event.name,
                    price = event.price,
                    status = event.status,
                    createdAt = event.eventTime
                )
            )
        } catch (e: Exception) {
            log.error("Failed to enqueue product for indexing: productId={}", event.productId, e)
            throw e  // Spring Kafka가 ExponentialBackOff 재시도 처리
        }
    }
}
```

**Step 3: `KafkaConsumerConfig.kt`**

```kotlin
package com.kgd.search.infrastructure.config

import com.kgd.search.infrastructure.messaging.ProductIndexEvent
import org.apache.kafka.clients.consumer.ConsumerConfig
import org.apache.kafka.common.serialization.StringDeserializer
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory
import org.springframework.kafka.core.DefaultKafkaConsumerFactory
import org.springframework.kafka.listener.DefaultErrorHandler
import org.springframework.kafka.support.serializer.JsonDeserializer
import org.springframework.util.backoff.ExponentialBackOff

@Configuration
class KafkaConsumerConfig {

    @Value("\${spring.kafka.bootstrap-servers}")
    private lateinit var bootstrapServers: String

    @Value("\${kafka.consumer.group-id}")
    private lateinit var groupId: String

    @Bean
    fun productEventListenerContainerFactory() =
        ConcurrentKafkaListenerContainerFactory<String, ProductIndexEvent>().apply {
            setConsumerFactory(
                DefaultKafkaConsumerFactory(
                    mapOf(
                        ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG to bootstrapServers,
                        ConsumerConfig.GROUP_ID_CONFIG to groupId,
                        ConsumerConfig.AUTO_OFFSET_RESET_CONFIG to "earliest",
                        ConsumerConfig.MAX_POLL_RECORDS_CONFIG to 50,
                        ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG to StringDeserializer::class.java,
                        ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG to JsonDeserializer::class.java,
                        JsonDeserializer.TRUSTED_PACKAGES to "com.kgd.*",
                        JsonDeserializer.VALUE_DEFAULT_TYPE to ProductIndexEvent::class.java.name
                    )
                )
            )
            setCommonErrorHandler(
                DefaultErrorHandler(
                    ExponentialBackOff(1000L, 2.0).apply { maxElapsedTime = 30_000L }
                )
            )
        }
}
```

**Step 4: `application.yml`**

```yaml
spring:
  application:
    name: search-consumer
  elasticsearch:
    uris: ${ELASTICSEARCH_URIS:http://localhost:9200}
  kafka:
    bootstrap-servers: ${KAFKA_BOOTSTRAP_SERVERS:localhost:9092}

kafka:
  consumer:
    group-id: search-indexer

search:
  index:
    alias: products

server:
  port: 8084

management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics

eureka:
  client:
    service-url:
      defaultZone: ${EUREKA_DEFAULT_ZONE:http://localhost:8761/eureka/}
  instance:
    prefer-ip-address: true
```

**Step 5: `ProductIndexingConsumerTest.kt`**

```kotlin
class ProductIndexingConsumerTest : BehaviorSpec({
    val bulkProcessor = mockk<EsBulkDocumentProcessor>(relaxed = true)
    val consumer = ProductIndexingConsumer(bulkProcessor)

    beforeEach { clearMocks(bulkProcessor) }

    val event = ProductIndexEvent(
        productId = 1L,
        name = "테스트 상품",
        price = BigDecimal("10000"),
        status = "ACTIVE",
        eventTime = LocalDateTime.now()
    )

    given("유효한 ProductIndexEvent 수신 시") {
        `when`("consume 이 호출되면") {
            then("bulkProcessor.processDocument 가 올바른 인덱스명과 문서로 호출되어야 한다") {
                val slot = slot<ProductDocument>()
                every { bulkProcessor.processDocument(any(), capture(slot)) } just Runs

                consumer.consume(event)

                verify(exactly = 1) { bulkProcessor.processDocument("products", any()) }
                slot.captured.id shouldBe "1"
                slot.captured.name shouldBe "테스트 상품"
                slot.captured.status shouldBe "ACTIVE"
            }
        }
    }

    given("bulkProcessor 가 예외를 던질 때") {
        `when`("consume 이 호출되면") {
            then("예외가 재전파되어야 한다 (Spring Kafka 재시도를 위해)") {
                every { bulkProcessor.processDocument(any(), any()) } throws RuntimeException("ES down")
                shouldThrow<RuntimeException> { consumer.consume(event) }
            }
        }
    }
})
```

---

## Task 4: search:batch — Gradle 모듈 생성 + IndexAliasManager

**Files:**
- Create: `search/batch/build.gradle.kts`
- Create: `search/batch/src/main/kotlin/com/kgd/search/SearchBatchApplication.kt`
- Create: `search/batch/src/main/kotlin/com/kgd/search/infrastructure/indexing/EsBulkDocumentProcessor.kt` (consumer와 동일 구현)
- Create: `search/batch/src/main/kotlin/com/kgd/search/infrastructure/indexing/IndexAliasManager.kt`
- Create: `search/batch/src/main/kotlin/com/kgd/search/infrastructure/config/ElasticsearchClientConfig.kt`
- Create: `search/batch/src/test/kotlin/com/kgd/search/infrastructure/indexing/IndexAliasManagerTest.kt`

**Step 1: `search/batch/build.gradle.kts`**

```kotlin
plugins {
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.spring.boot)
}

dependencies {
    implementation(project(":search:domain"))
    implementation(project(":common"))
    implementation(libs.spring.boot.starter.actuator)
    implementation(libs.spring.boot.starter.data.elasticsearch)
    implementation(libs.spring.boot.starter.batch)
    implementation(libs.spring.webflux)
    implementation(libs.kotlin.coroutines.reactor)
    runtimeOnly(libs.h2)
    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.kotest.extensions.spring)
    testImplementation(libs.spring.batch.test)
}

tasks.bootJar {
    archiveBaseName.set("search-batch")
}
```

`gradle/libs.versions.toml` 에 다음 추가 필요:
```toml
[libraries]
spring-boot-starter-batch = { module = "org.springframework.boot:spring-boot-starter-batch" }
spring-batch-test = { module = "org.springframework.batch:spring-batch-test" }
h2 = { module = "com.h2database:h2" }
```

**Step 2: `SearchBatchApplication.kt`**

```kotlin
package com.kgd.search

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication
class SearchBatchApplication

fun main(args: Array<String>) {
    runApplication<SearchBatchApplication>(*args)
}
```

**Step 3: `EsBulkDocumentProcessor.kt` — consumer와 동일 (복사 후 패키지만 동일)**

> search:batch 는 독립 배포 단위이므로 consumer와 구현을 공유하지 않음 (MSA 서비스 격리 원칙)
> 코드는 Task 2 Step 4 와 동일

**Step 4: `IndexAliasManager.kt`**

```kotlin
package com.kgd.search.infrastructure.indexing

import co.elastic.clients.elasticsearch.ElasticsearchClient
import co.elastic.clients.elasticsearch.indices.UpdateAliasesRequest
import co.elastic.clients.elasticsearch.indices.AliasDefinition
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

@Component
class IndexAliasManager(private val esClient: ElasticsearchClient) {

    private val log = LoggerFactory.getLogger(javaClass)
    private val timestampFormatter = DateTimeFormatter.ofPattern("yyyyMMddHHmmss")

    /** 새 타임스탬프 색인명 생성: products_20260309120000 */
    fun createTimestampedIndexName(alias: String): String =
        "${alias}_${LocalDateTime.now().format(timestampFormatter)}"

    /** Elasticsearch에 새 색인 생성 (nori 분석기 + 매핑 적용) */
    fun createIndex(indexName: String) {
        esClient.indices().create { req ->
            req.index(indexName)
               .settings { s ->
                   s.analysis { a ->
                       a.analyzer("nori_analyzer") { an ->
                           an.custom { c -> c.tokenizer("nori_tokenizer") }
                       }
                   }
               }
               .mappings { m ->
                   m.properties("name") { p ->
                       p.text { t -> t.analyzer("nori_analyzer") }
                   }
                   m.properties("status") { p -> p.keyword { it } }
                   m.properties("price") { p -> p.double_ { it } }
                   m.properties("createdAt") { p ->
                       p.date { d -> d.format("yyyy-MM-dd'T'HH:mm:ss") }
                   }
               }
        }
        log.info("Created index: {}", indexName)
    }

    /**
     * alias를 newIndexName 으로 교체하고, 이전 색인 중 maxRetention 초과분을 삭제.
     * @param alias        alias 이름 (예: "products")
     * @param newIndexName 새로 생성한 색인 이름
     * @param maxRetention 보관할 이전 색인 수 (기본 2)
     */
    fun updateAliasAndCleanup(alias: String, newIndexName: String, maxRetention: Int = 2) {
        // 현재 alias가 가리키는 색인 목록
        val existingIndices = getIndicesForAlias(alias)

        esClient.indices().updateAliases { req ->
            req.actions { action ->
                // 기존 alias 제거
                existingIndices.forEach { oldIndex ->
                    action.remove { r -> r.index(oldIndex).alias(alias) }
                }
                // 새 alias 추가
                action.add { a -> a.index(newIndexName).alias(alias) }
            }
        }
        log.info("Alias '{}' now points to '{}'", alias, newIndexName)

        // 오래된 색인 정리 (maxRetention 초과분 삭제)
        val indicesToDelete = existingIndices
            .sortedDescending()
            .drop(maxRetention)
        indicesToDelete.forEach { oldIndex ->
            esClient.indices().delete { d -> d.index(oldIndex) }
            log.info("Deleted old index: {}", oldIndex)
        }
    }

    private fun getIndicesForAlias(alias: String): List<String> =
        runCatching {
            esClient.indices().getAlias { it.name(alias) }
                .result().keys.toList()
        }.getOrElse { emptyList() }
}
```

**Step 5: `IndexAliasManagerTest.kt`**

```kotlin
class IndexAliasManagerTest : BehaviorSpec({
    val esClient = mockk<ElasticsearchClient>(relaxed = true)
    val manager = IndexAliasManager(esClient)

    given("타임스탬프 색인명 생성 시") {
        `when`("alias 이름이 주어지면") {
            then("products_YYYYMMDDHHMMSS 형식이어야 한다") {
                val name = manager.createTimestampedIndexName("products")
                name shouldStartWith "products_"
                name.length shouldBe "products_".length + 14
            }
        }
    }
})
```

---

## Task 5: search:batch — ProductApiClient + ProductReindexTasklet + Spring Batch Job

**Files:**
- Create: `search/batch/src/main/kotlin/com/kgd/search/infrastructure/client/ProductApiClient.kt`
- Create: `search/batch/src/main/kotlin/com/kgd/search/job/ProductReindexJobConfig.kt`
- Create: `search/batch/src/main/kotlin/com/kgd/search/job/ProductReindexTasklet.kt`
- Create: `search/batch/src/main/kotlin/com/kgd/search/infrastructure/config/WebClientConfig.kt`
- Create: `search/batch/src/main/resources/application.yml`
- Create: `search/batch/src/test/kotlin/com/kgd/search/job/ProductReindexTaskletTest.kt`

**Step 1: `WebClientConfig.kt`**

```kotlin
package com.kgd.search.infrastructure.config

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.web.reactive.function.client.WebClient

@Configuration
class WebClientConfig {

    @Value("\${product.service.url:http://localhost:8081}")
    private lateinit var productServiceUrl: String

    @Bean("productWebClient")
    fun productWebClient(builder: WebClient.Builder): WebClient =
        builder.baseUrl(productServiceUrl).build()
}
```

**Step 2: `ProductApiClient.kt` — product:app 호출 페이지네이션**

```kotlin
package com.kgd.search.infrastructure.client

import kotlinx.coroutines.reactor.awaitSingle
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.client.WebClient
import java.math.BigDecimal
import java.time.LocalDateTime

@Component
class ProductApiClient(
    @Qualifier("productWebClient") private val webClient: WebClient
) {
    private val log = LoggerFactory.getLogger(javaClass)

    data class ProductDto(
        val id: Long,
        val name: String,
        val price: BigDecimal,
        val status: String
    )

    data class ProductPageResponse(
        val products: List<ProductDto>,
        val totalElements: Long,
        val totalPages: Int
    )

    data class ApiResponse<T>(
        val success: Boolean,
        val data: T?
    )

    suspend fun fetchPage(page: Int, size: Int = 100): ProductPageResponse {
        log.debug("Fetching products: page={}, size={}", page, size)
        val response = webClient.get()
            .uri("/api/products?page=$page&size=$size")
            .retrieve()
            .bodyToMono(
                com.fasterxml.jackson.core.type.TypeReference::class.java.let {
                    // Use ParameterizedTypeReference for generic type
                    object : org.springframework.core.ParameterizedTypeReference<Map<String, Any>>() {}
                }
            )
            .awaitSingle()

        @Suppress("UNCHECKED_CAST")
        val data = response["data"] as? Map<String, Any>
            ?: throw IllegalStateException("No data in product API response")

        @Suppress("UNCHECKED_CAST")
        val products = (data["products"] as? List<Map<String, Any>> ?: emptyList()).map { p ->
            ProductDto(
                id = (p["id"] as Number).toLong(),
                name = p["name"] as String,
                price = BigDecimal(p["price"].toString()),
                status = p["status"] as String
            )
        }
        return ProductPageResponse(
            products = products,
            totalElements = (data["totalElements"] as Number).toLong(),
            totalPages = (data["totalPages"] as Number).toInt()
        )
    }
}
```

**Step 3: `ProductReindexTasklet.kt`**

```kotlin
package com.kgd.search.job

import com.kgd.search.domain.product.model.ProductDocument
import com.kgd.search.infrastructure.client.ProductApiClient
import com.kgd.search.infrastructure.indexing.EsBulkDocumentProcessor
import com.kgd.search.infrastructure.indexing.IndexAliasManager
import kotlinx.coroutines.runBlocking
import org.slf4j.LoggerFactory
import org.springframework.batch.core.StepContribution
import org.springframework.batch.core.scope.context.ChunkContext
import org.springframework.batch.core.step.tasklet.Tasklet
import org.springframework.batch.repeat.RepeatStatus
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.time.LocalDateTime

@Component
class ProductReindexTasklet(
    private val productApiClient: ProductApiClient,
    private val bulkProcessor: EsBulkDocumentProcessor,
    private val aliasManager: IndexAliasManager
) : Tasklet {

    private val log = LoggerFactory.getLogger(javaClass)

    @Value("\${search.index.alias:products}")
    private lateinit var indexAlias: String

    @Value("\${search.batch.page-size:100}")
    private var pageSize: Int = 100

    override fun execute(contribution: StepContribution, chunkContext: ChunkContext): RepeatStatus = runBlocking {
        val newIndexName = aliasManager.createTimestampedIndexName(indexAlias)
        log.info("Starting full reindex → {}", newIndexName)

        aliasManager.createIndex(newIndexName)

        var page = 0
        var totalIndexed = 0L

        do {
            val response = productApiClient.fetchPage(page, pageSize)
            response.products.forEach { product ->
                bulkProcessor.processDocument(
                    newIndexName,
                    ProductDocument(
                        id = product.id.toString(),
                        name = product.name,
                        price = product.price,
                        status = product.status,
                        createdAt = LocalDateTime.now()
                    )
                )
                totalIndexed++
            }
            log.info("Fetched page {}/{}: {} products", page + 1, response.totalPages, response.products.size)
            page++
        } while (page < response.totalPages)

        // BulkIngester 잔여 작업 강제 전송 후 alias 교체
        bulkProcessor.flush()
        Thread.sleep(1000L) // flush 완료 대기

        aliasManager.updateAliasAndCleanup(indexAlias, newIndexName)

        log.info("Reindex complete: {} products → {}, errors={}", totalIndexed, newIndexName, bulkProcessor.errorCount.get())
        RepeatStatus.FINISHED
    }
}
```

**Step 4: `ProductReindexJobConfig.kt`**

```kotlin
package com.kgd.search.job

import org.springframework.batch.core.Job
import org.springframework.batch.core.Step
import org.springframework.batch.core.job.builder.JobBuilder
import org.springframework.batch.core.repository.JobRepository
import org.springframework.batch.core.step.builder.StepBuilder
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.transaction.PlatformTransactionManager

@Configuration
class ProductReindexJobConfig(
    private val jobRepository: JobRepository,
    private val transactionManager: PlatformTransactionManager,
    private val reindexTasklet: ProductReindexTasklet
) {
    @Bean
    fun productReindexJob(reindexStep: Step): Job =
        JobBuilder("productReindexJob", jobRepository)
            .start(reindexStep)
            .build()

    @Bean
    fun reindexStep(): Step =
        StepBuilder("reindexStep", jobRepository)
            .tasklet(reindexTasklet, transactionManager)
            .build()
}
```

**Step 5: `application.yml`**

```yaml
spring:
  application:
    name: search-batch
  elasticsearch:
    uris: ${ELASTICSEARCH_URIS:http://localhost:9200}
  datasource:
    url: jdbc:h2:mem:batch-db;DB_CLOSE_DELAY=-1
    driver-class-name: org.h2.Driver
    username: sa
    password:
  batch:
    job:
      enabled: false   # 자동 실행 OFF (REST/스케줄러로 수동 실행)
    jdbc:
      initialize-schema: always

product:
  service:
    url: ${PRODUCT_SERVICE_URL:http://localhost:8081}

search:
  index:
    alias: products
  batch:
    page-size: 100

server:
  port: 8085

management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,batch

eureka:
  client:
    service-url:
      defaultZone: ${EUREKA_DEFAULT_ZONE:http://localhost:8761/eureka/}
  instance:
    prefer-ip-address: true
```

**Step 6: `ProductReindexTaskletTest.kt`**

```kotlin
class ProductReindexTaskletTest : BehaviorSpec({
    val productApiClient = mockk<ProductApiClient>()
    val bulkProcessor = mockk<EsBulkDocumentProcessor>(relaxed = true)
    val aliasManager = mockk<IndexAliasManager>(relaxed = true)

    beforeEach { clearMocks(productApiClient, bulkProcessor, aliasManager) }

    given("전체 색인 실행 시") {
        `when`("상품이 1페이지 분량이면") {
            then("모든 상품을 색인하고 alias를 교체해야 한다") {
                coEvery { productApiClient.fetchPage(0, any()) } returns ProductApiClient.ProductPageResponse(
                    products = listOf(
                        ProductApiClient.ProductDto(1L, "상품A", BigDecimal("1000"), "ACTIVE")
                    ),
                    totalElements = 1L,
                    totalPages = 1
                )
                every { aliasManager.createTimestampedIndexName(any()) } returns "products_20260309120000"

                val tasklet = ProductReindexTasklet(productApiClient, bulkProcessor, aliasManager)
                // indexAlias 필드 리플렉션으로 설정
                tasklet::class.java.getDeclaredField("indexAlias").apply {
                    isAccessible = true
                    set(tasklet, "products")
                }
                tasklet::class.java.getDeclaredField("pageSize").apply {
                    isAccessible = true
                    setInt(tasklet, 100)
                }

                tasklet.execute(mockk(relaxed = true), mockk(relaxed = true))

                verify(exactly = 1) { bulkProcessor.processDocument("products_20260309120000", any()) }
                verify(exactly = 1) { aliasManager.updateAliasAndCleanup("products", "products_20260309120000") }
            }
        }
    }
})
```

**Step 7: 빌드 확인 (Task 7 이후에 수행)**

---

## Task 6: search:app — 쓰기 컴포넌트 제거 (읽기 전용으로 정리)

**Files:**
- Delete: `search/app/src/main/kotlin/com/kgd/search/config/KafkaConsumerConfig.kt`
- Delete: `search/app/src/main/kotlin/com/kgd/search/elasticsearch/ProductBulkIndexer.kt`
- Delete: `search/app/src/main/kotlin/com/kgd/search/messaging/ProductIndexingConsumer.kt`
- Delete: `search/app/src/main/kotlin/com/kgd/search/messaging/ProductIndexEvent.kt`
- Delete: `search/app/src/test/kotlin/com/kgd/search/elasticsearch/ProductBulkIndexerTest.kt`
- Delete: `search/app/src/test/kotlin/com/kgd/search/messaging/ProductIndexingConsumerTest.kt`
- Modify: `search/app/build.gradle.kts` — `spring.kafka` 의존성 제거
- Modify: `search/domain/src/main/kotlin/com/kgd/search/product/port/ProductIndexPort.kt` — 유지 (batch/consumer에서 사용)

**Step 1: 파일 삭제**

```bash
cd /path/to/msa
rm search/app/src/main/kotlin/com/kgd/search/config/KafkaConsumerConfig.kt
rm search/app/src/main/kotlin/com/kgd/search/elasticsearch/ProductBulkIndexer.kt
rm search/app/src/main/kotlin/com/kgd/search/messaging/ProductIndexingConsumer.kt
rm search/app/src/main/kotlin/com/kgd/search/messaging/ProductIndexEvent.kt
rm search/app/src/test/kotlin/com/kgd/search/elasticsearch/ProductBulkIndexerTest.kt
rm search/app/src/test/kotlin/com/kgd/search/messaging/ProductIndexingConsumerTest.kt
```

**Step 2: `search/app/build.gradle.kts` 에서 Kafka 제거**

```kotlin
// 제거:  implementation(libs.spring.kafka)
// 유지: spring-boot-starter-data-elasticsearch, spring-boot-starter-web 등
```

**Step 3: 빌드 확인**
```bash
./gradlew :search:app:build
```

**Step 4: 커밋**
```bash
git add search/app/
git commit -m "refactor(search:app): remove write components, keep read-only REST API"
```

---

## Task 7: 인프라 통합 — settings.gradle.kts + libs.versions.toml + Docker + CLAUDE.md

**Files:**
- Modify: `settings.gradle.kts`
- Modify: `gradle/libs.versions.toml`
- Modify: `docker/Dockerfile`
- Modify: `docker/docker-compose.yml`
- Modify: `CLAUDE.md` — Section 6, 7
- Modify: `README.md` — 모듈 구조 섹션

**Step 1: `settings.gradle.kts` 업데이트**

```kotlin
rootProject.name = "commerce-platform"

include(
    "common",
    "discovery",
    "gateway",
    "product:domain",
    "product:app",
    "order:domain",
    "order:app",
    "search:domain",
    "search:app",
    "search:consumer",
    "search:batch"
)
```

**Step 2: `gradle/libs.versions.toml` 추가**

```toml
[libraries]
# (기존 항목들 유지하고 아래 추가)
spring-boot-starter-batch = { module = "org.springframework.boot:spring-boot-starter-batch" }
spring-batch-test = { module = "org.springframework.batch:spring-batch-test" }
h2 = { module = "com.h2database:h2" }
```

**Step 3: `docker/Dockerfile` — search:consumer, search:batch 빌드 파일 추가**

기존 Dockerfile 의 COPY 섹션에 추가:
```dockerfile
COPY search/consumer/build.gradle.kts search/consumer/
COPY search/batch/build.gradle.kts search/batch/
```

**Step 4: `docker/docker-compose.yml` — consumer, batch 서비스 추가**

```yaml
search-consumer:
  build:
    context: ..
    dockerfile: docker/Dockerfile
    args:
      MODULE_GRADLE: search:consumer
      MODULE_PATH: search/consumer
  image: commerce/search-consumer:latest
  container_name: search-consumer
  ports:
    - "8084:8084"
  environment:
    SPRING_PROFILES_ACTIVE: ${SPRING_PROFILES_ACTIVE:-docker}
    ELASTICSEARCH_URIS: http://elasticsearch:9200
    KAFKA_BOOTSTRAP_SERVERS: kafka:9092
    EUREKA_DEFAULT_ZONE: http://discovery:8761/eureka/
  depends_on:
    discovery:
      condition: service_healthy
    elasticsearch:
      condition: service_healthy
    kafka:
      condition: service_healthy
  networks:
    commerce-network:
      ipv4_address: 172.20.0.51
  restart: unless-stopped

search-batch:
  build:
    context: ..
    dockerfile: docker/Dockerfile
    args:
      MODULE_GRADLE: search:batch
      MODULE_PATH: search/batch
  image: commerce/search-batch:latest
  container_name: search-batch
  ports:
    - "8085:8085"
  environment:
    SPRING_PROFILES_ACTIVE: ${SPRING_PROFILES_ACTIVE:-docker}
    ELASTICSEARCH_URIS: http://elasticsearch:9200
    PRODUCT_SERVICE_URL: http://product:8081
    EUREKA_DEFAULT_ZONE: http://discovery:8761/eureka/
  depends_on:
    discovery:
      condition: service_healthy
    elasticsearch:
      condition: service_healthy
    product:
      condition: service_started
  networks:
    commerce-network:
      ipv4_address: 172.20.0.52
  restart: unless-stopped
```

**Step 5: `CLAUDE.md` 업데이트**

Section 6 (Module & Build Rules) 에 추가:
- search:consumer / search:batch 모듈 설명
- 각 모듈의 archiveBaseName 규칙

Section 7 (Package Naming) 에 search:consumer, search:batch 패키지 구조 추가:
```
search:consumer → com.kgd.search.infrastructure.{indexing,messaging,config}
search:batch    → com.kgd.search.{job,infrastructure.{client,indexing,config}}
```

**Step 6: 전체 빌드 및 테스트**

```bash
./gradlew build
./gradlew :search:consumer:build
./gradlew :search:batch:build
./gradlew :search:consumer:test
./gradlew :search:batch:test
```

**Step 7: 커밋**

```bash
git add .
git commit -m "feat(search): add search:consumer (incremental) and search:batch (full reindex) modules with BulkIngester pipeline"
```

---

## 최종 모듈 구조

```
search/
├── build.gradle.kts     ← 컨테이너
├── domain/              ← ProductDocument, ProductSearchPort, ProductIndexPort
├── app/                 ← 읽기 전용 REST 검색 API (포트 8083)
├── consumer/            ← Kafka 증분 색인 (포트 8084, BulkIngester)
└── batch/               ← Spring Batch 전체 색인 (포트 8085, alias swap)
```

## 검증 시나리오

```bash
# 1. 인프라 기동
docker compose -f docker/docker-compose.infra.yml up -d

# 2. 전체 빌드
./gradlew build

# 3. 도메인 단독 테스트
./gradlew :search:domain:test

# 4. 컨슈머/배치 테스트
./gradlew :search:consumer:test
./gradlew :search:batch:test

# 5. 배치 실행 확인 (product:app 기동 후)
curl -X POST http://localhost:8085/actuator/batch/jobs/productReindexJob
```
