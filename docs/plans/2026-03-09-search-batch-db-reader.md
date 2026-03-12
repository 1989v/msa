# Search Batch DB-Direct Reader Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** search-batch에 DB 직접 리드 방식의 색인 Job을 추가하여 API 방식(기존)과 DB 방식(신규)을 `reindex.source` 설정으로 선택 가능하게 하고, CDC 파이프라인 확장 문서를 작성한다.

**Architecture:**
기존 `productApiReindexJob` (WebClient → Product API → ES)과 신규 `productDbReindexJob` (JDBC → product-replica → ES)을 분리된 Spring Batch Job 설정으로 구현한다.
`reindex.source=api`(기본값)이면 API Job, `reindex.source=db`이면 DB Job이 활성화된다.
DB Job은 Spring Batch의 `JdbcPagingItemReader → ItemProcessor → ItemWriter` Chunk 패턴을 사용하며, 인덱스 생성·alias swap은 `JobExecutionListener`에서 처리한다.

**Tech Stack:**
- Spring Batch 6 (`JdbcPagingItemReader`, `SqlPagingQueryProviderFactoryBean`, `JobExecutionListener`)
- MySQL 8.0 read replica (JDBC, `mysql-connector-j`)
- `EsBulkDocumentProcessor` (기존 재사용)
- `IndexAliasManager` (기존 재사용)
- Kotest BehaviorSpec + MockK (테스트)

---

## 배경 지식: 왜 두 방식이 필요한가

| 항목 | API 방식 (기존) | DB 직접 방식 (신규) |
|------|----------------|---------------------|
| 데이터 소스 | Product REST API (`/api/products?page=N`) | product-replica MySQL |
| 페이지네이션 | offset 기반 → 배치 중 insert/delete 시 skip/dup 가능 | keyset(id) 기반 → 삽입/삭제에도 안정 |
| 스냅샷 일관성 | 페이지마다 최신 데이터 → 시점 불일치 가능 | 배치 시작 시점 replica lag만큼의 고정 뷰 |
| 서비스 경계 | 준수 | **예외 허용** (ADR-0009로 명문화) |
| 적합 용도 | 경량 운영 색인, Product API가 살아있을 때 | 초기 대량 색인, DR 복구, 정확한 스냅샷 필요 시 |

---

## Task 1: ADR-0009 작성

**Files:**
- Create: `docs/adr/ADR-0009-search-batch-db-direct-access.md`

**Step 1: ADR 파일 생성**

```markdown
# ADR-0009: Search Batch DB 직접 접근 예외 허용

## Status
Accepted

## Context
`search-batch`의 전체 색인 배치는 Product API를 통해 데이터를 소싱한다.
API 방식은 offset 기반 페이지네이션을 사용하므로, 배치 실행 중 product 데이터가 변경되면
페이지 드리프트(skip/duplicate)와 시점 불일치가 발생할 수 있다.
대용량 초기 색인 또는 DR 복구 시나리오에서는 스냅샷 일관성이 더 중요하다.

## Decision
`search-batch` 모듈에 한해 `mysql-product-replica` 에 대한 JDBC 읽기 전용 접근을 예외적으로 허용한다.

- 접근 범위: **읽기 전용 (SELECT only)**
- 대상 DB: `mysql-product-replica` (마스터 아님)
- 자격증명: 배치 전용 read-only 계정 권장 (`PRODUCT_DB_USER`, `PRODUCT_DB_PASSWORD`)
- 활성화 조건: `reindex.source=db` 환경변수 설정 시에만 동작
- 기본값: `reindex.source=api` (기존 API 방식 유지)

두 방식은 서로 다른 Spring Batch Job으로 분리된다:
- `productApiReindexJob` (기존): `reindex.source=api` 또는 미설정 시 활성
- `productDbReindexJob` (신규): `reindex.source=db` 설정 시 활성

## Rationale
- **서비스 경계 원칙 최소 위반**: search-batch는 상시 서비스가 아닌 배치성 프로세스이며,
  읽기 전용으로만 접근한다.
- **운영 필요성 우선**: DR 복구, 초기 1억건 이상 색인 등 실무 시나리오에서
  API 방식의 페이지 드리프트는 허용 불가한 데이터 품질 문제를 유발한다.
- **아키텍처 보호**: 일반 서비스(search:app, search:consumer)는 여전히
  DB 직접 접근이 금지된다. 이 예외는 search-batch에만 적용된다.

## Consequences
- search-batch가 product DB 스키마에 결합됨 (테이블명, 컬럼명)
  → `products` 테이블 스키마 변경 시 search-batch 함께 수정 필요
- 별도 DB 자격증명 관리 필요 (`PRODUCT_DB_USER`, `PRODUCT_DB_PASSWORD`)
- docker-compose에 search-batch → mysql-product-replica 의존성 추가

## Future Extension
CDC 파이프라인(Debezium + Kafka Connect)을 도입하면 이 DB 직접 접근 없이도
스냅샷 일관성을 확보할 수 있다. 참조: `docs/architecture/cdc-pipeline.md`
```

**Step 2: 빌드 확인 불필요 (문서만), 커밋**

```bash
git add docs/adr/ADR-0009-search-batch-db-direct-access.md
git commit -m "docs: add ADR-0009 for search-batch DB direct access exception"
```

---

## Task 2: build.gradle.kts 업데이트

**Files:**
- Modify: `search/batch/build.gradle.kts`

**Background:**
`JdbcPagingItemReader`는 `spring-batch-infrastructure`에 이미 포함된다 (spring-boot-starter-batch 전이 의존성).
MySQL JDBC 드라이버(`mysql-connector-j`)만 추가하면 된다. `spring-boot-starter-data-jpa`는 불필요 — 엔티티 없이 순수 JDBC만 사용한다.

**Step 1: mysql-connector 추가**

`search/batch/build.gradle.kts`를 아래로 교체:

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
    runtimeOnly(libs.mysql.connector)   // ← 신규 추가
    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.kotest.extensions.spring)
    testImplementation(libs.kotest.runner.junit5)
    testImplementation(libs.kotest.assertions.core)
    testImplementation(libs.mockk)
    testImplementation(libs.spring.batch.test)
}

tasks.bootJar {
    archiveBaseName.set("search-batch")
}
```

**Step 2: 빌드 확인**

```bash
./gradlew :search:batch:build -x test --no-daemon
```

Expected: `BUILD SUCCESSFUL`

**Step 3: 커밋**

```bash
git add search/batch/build.gradle.kts
git commit -m "build(search-batch): add mysql-connector for DB-direct reindex"
```

---

## Task 3: 기존 API Job 클래스 이름 변경 + ConditionalOnProperty 추가

기존 `ProductReindexJobConfig`와 `ProductReindexTasklet`을 API 방식임을 명확히 하도록 이름 변경하고 조건 활성화를 추가한다.

**Files:**
- Rename: `search/batch/src/main/kotlin/com/kgd/search/job/ProductReindexTasklet.kt`
  → `search/batch/src/main/kotlin/com/kgd/search/job/ProductApiReindexTasklet.kt`
- Rename: `search/batch/src/main/kotlin/com/kgd/search/job/ProductReindexJobConfig.kt`
  → `search/batch/src/main/kotlin/com/kgd/search/job/ProductApiReindexJobConfig.kt`
- Modify: `search/batch/src/test/kotlin/com/kgd/search/job/ProductReindexTaskletTest.kt`
  → update import/class reference

**Step 1: ProductApiReindexTasklet.kt 생성 (기존 파일 내용 이전)**

`search/batch/src/main/kotlin/com/kgd/search/job/ProductApiReindexTasklet.kt`:

```kotlin
package com.kgd.search.job

import com.kgd.search.domain.product.model.ProductDocument
import com.kgd.search.infrastructure.client.ProductApiClient
import com.kgd.search.infrastructure.indexing.EsBulkDocumentProcessor
import com.kgd.search.infrastructure.indexing.IndexAliasManager
import kotlinx.coroutines.runBlocking
import org.slf4j.LoggerFactory
import org.springframework.batch.core.step.StepContribution
import org.springframework.batch.core.scope.context.ChunkContext
import org.springframework.batch.core.step.tasklet.Tasklet
import org.springframework.batch.infrastructure.repeat.RepeatStatus
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Component

@Component
@ConditionalOnProperty(name = ["reindex.source"], havingValue = "api", matchIfMissing = true)
class ProductApiReindexTasklet(
    private val productApiClient: ProductApiClient,
    private val bulkProcessor: EsBulkDocumentProcessor,
    private val aliasManager: IndexAliasManager
) : Tasklet {

    private val log = LoggerFactory.getLogger(javaClass)

    @Value("\${search.index.alias:products}")
    private lateinit var indexAlias: String

    @Value("\${search.batch.page-size:100}")
    private var pageSize: Int = 100

    override fun execute(contribution: StepContribution, chunkContext: ChunkContext): RepeatStatus =
        runBlocking {
            val newIndexName = aliasManager.createTimestampedIndexName(indexAlias)
            log.info("Starting full reindex (API) → {}", newIndexName)

            aliasManager.createIndex(newIndexName)

            var page = 0
            var totalPages: Int
            var totalIndexed = 0L

            do {
                val response = productApiClient.fetchPage(page, pageSize)
                totalPages = response.totalPages

                response.products.forEach { product ->
                    bulkProcessor.processDocument(
                        newIndexName,
                        ProductDocument(
                            id = product.id.toString(),
                            name = product.name,
                            price = product.price,
                            status = product.status,
                            createdAt = product.createdAt
                        )
                    )
                    totalIndexed++
                }

                log.info("Processed page {}/{}: {} products", page + 1, totalPages, response.products.size)
                page++
            } while (page < totalPages)

            // flush remaining operations before alias swap (blocks until complete)
            bulkProcessor.flush()

            aliasManager.updateAliasAndCleanup(indexAlias, newIndexName)
            log.info("Reindex complete: {} docs indexed, {} errors", totalIndexed, bulkProcessor.errorCount.get())

            RepeatStatus.FINISHED
        }
}
```

**Step 2: ProductApiReindexJobConfig.kt 생성**

`search/batch/src/main/kotlin/com/kgd/search/job/ProductApiReindexJobConfig.kt`:

```kotlin
package com.kgd.search.job

import org.springframework.batch.core.job.Job
import org.springframework.batch.core.step.Step
import org.springframework.batch.core.job.builder.JobBuilder
import org.springframework.batch.core.repository.JobRepository
import org.springframework.batch.core.step.builder.StepBuilder
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.transaction.PlatformTransactionManager

@Configuration
@ConditionalOnProperty(name = ["reindex.source"], havingValue = "api", matchIfMissing = true)
class ProductApiReindexJobConfig(
    private val jobRepository: JobRepository,
    private val transactionManager: PlatformTransactionManager,
    private val reindexTasklet: ProductApiReindexTasklet
) {
    @Bean
    fun productApiReindexJob(apiReindexStep: Step): Job =
        JobBuilder("productApiReindexJob", jobRepository)
            .start(apiReindexStep)
            .build()

    @Bean
    fun apiReindexStep(): Step =
        StepBuilder("apiReindexStep", jobRepository)
            .tasklet(reindexTasklet, transactionManager)
            .build()
}
```

**Step 3: 기존 파일 삭제**

```bash
rm search/batch/src/main/kotlin/com/kgd/search/job/ProductReindexTasklet.kt
rm search/batch/src/main/kotlin/com/kgd/search/job/ProductReindexJobConfig.kt
```

**Step 4: 테스트 파일 클래스 참조 수정**

`search/batch/src/test/kotlin/com/kgd/search/job/ProductReindexTaskletTest.kt`:
- `ProductReindexTasklet` → `ProductApiReindexTasklet` 으로 변경
- 클래스 인스턴스 생성 부분 동일하게 수정

**Step 5: 빌드 + 테스트**

```bash
./gradlew :search:batch:test --no-daemon
```

Expected: `BUILD SUCCESSFUL`, 기존 테스트 통과

**Step 6: 커밋**

```bash
git add search/batch/src/main/kotlin/com/kgd/search/job/
git add search/batch/src/test/kotlin/com/kgd/search/job/
git commit -m "refactor(search-batch): rename to ProductApiReindexJob, add ConditionalOnProperty"
```

---

## Task 4: ProductDataSourceConfig — product-replica 전용 DataSource

**Files:**
- Create: `search/batch/src/main/kotlin/com/kgd/search/infrastructure/config/ProductDataSourceConfig.kt`

**Background:**
Spring Batch는 `@Primary` DataSource를 `JobRepository` 용으로 사용한다.
현재 H2가 Primary이며 이를 유지한다. product-replica용 DataSource는 `@Qualifier("productDataSource")`로 별도 등록한다.
이 Bean은 `reindex.source=db`일 때만 생성한다.

**Step 1: ProductDataSourceConfig 작성**

```kotlin
package com.kgd.search.infrastructure.config

import com.zaxxer.hikari.HikariDataSource
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import javax.sql.DataSource

@Configuration
@ConditionalOnProperty(name = ["reindex.source"], havingValue = "db")
class ProductDataSourceConfig {

    @Value("\${product.datasource.url}")
    private lateinit var url: String

    @Value("\${product.datasource.username}")
    private lateinit var username: String

    @Value("\${product.datasource.password}")
    private lateinit var password: String

    @Bean("productDataSource")
    fun productDataSource(): DataSource = HikariDataSource().apply {
        jdbcUrl = url
        this.username = this@ProductDataSourceConfig.username
        this.password = this@ProductDataSourceConfig.password
        driverClassName = "com.mysql.cj.jdbc.Driver"
        maximumPoolSize = 5
        isReadOnly = true                           // 읽기 전용 강제
        connectionTimeout = 30_000L
        poolName = "product-replica-pool"
    }
}
```

**주의:** `HikariCP`는 `spring-boot-starter-batch`에 포함된다. 별도 의존성 추가 불필요.

**Step 2: 빌드 확인**

```bash
./gradlew :search:batch:build -x test --no-daemon
```

Expected: `BUILD SUCCESSFUL`

---

## Task 5: ProductRow + ReindexJobExecutionListener + ProductEsItemWriter

DB reader 파이프라인의 핵심 컴포넌트 세 가지를 작성한다.

**Files:**
- Create: `search/batch/src/main/kotlin/com/kgd/search/job/ProductRow.kt`
- Create: `search/batch/src/main/kotlin/com/kgd/search/job/ReindexJobExecutionListener.kt`
- Create: `search/batch/src/main/kotlin/com/kgd/search/job/ProductEsItemWriter.kt`

**Step 1: ProductRow 데이터 클래스**

```kotlin
package com.kgd.search.job

import java.math.BigDecimal
import java.time.LocalDateTime

data class ProductRow(
    val id: Long,
    val name: String,
    val price: BigDecimal,
    val stock: Int,
    val status: String,
    val createdAt: LocalDateTime
)
```

**Step 2: ReindexJobExecutionListener**

인덱스 생성(beforeJob), flush + alias swap(afterJob)을 담당한다.
Step과 Job이 공유하는 상태(newIndexName)는 `JobExecutionContext`에 저장한다.

```kotlin
package com.kgd.search.job

import com.kgd.search.infrastructure.indexing.EsBulkDocumentProcessor
import com.kgd.search.infrastructure.indexing.IndexAliasManager
import org.slf4j.LoggerFactory
import org.springframework.batch.core.BatchStatus
import org.springframework.batch.core.JobExecution
import org.springframework.batch.core.JobExecutionListener

class ReindexJobExecutionListener(
    private val aliasManager: IndexAliasManager,
    private val bulkProcessor: EsBulkDocumentProcessor,
    private val indexAlias: String
) : JobExecutionListener {

    private val log = LoggerFactory.getLogger(javaClass)

    companion object {
        const val NEW_INDEX_NAME_KEY = "newIndexName"
    }

    override fun beforeJob(jobExecution: JobExecution) {
        val newIndexName = aliasManager.createTimestampedIndexName(indexAlias)
        aliasManager.createIndex(newIndexName)
        jobExecution.executionContext.putString(NEW_INDEX_NAME_KEY, newIndexName)
        log.info("Created new index for reindex: {}", newIndexName)
    }

    override fun afterJob(jobExecution: JobExecution) {
        if (jobExecution.status != BatchStatus.COMPLETED) {
            log.warn("Job did not complete successfully ({}), skipping alias swap", jobExecution.status)
            return
        }
        val newIndexName = jobExecution.executionContext.getString(NEW_INDEX_NAME_KEY)
        bulkProcessor.flush()
        aliasManager.updateAliasAndCleanup(indexAlias, newIndexName)
        log.info("Alias swap complete: {} → {} errors", newIndexName, bulkProcessor.errorCount.get())
    }
}
```

**Step 3: ProductEsItemWriter**

`StepExecutionListener`를 구현해 Step 시작 시 `JobExecutionContext`에서 `newIndexName`을 가져온다.

```kotlin
package com.kgd.search.job

import com.kgd.search.domain.product.model.ProductDocument
import com.kgd.search.infrastructure.indexing.EsBulkDocumentProcessor
import org.springframework.batch.core.StepExecution
import org.springframework.batch.core.StepExecutionListener
import org.springframework.batch.item.Chunk
import org.springframework.batch.item.ItemWriter

class ProductEsItemWriter(
    private val bulkProcessor: EsBulkDocumentProcessor
) : ItemWriter<ProductDocument>, StepExecutionListener {

    private lateinit var newIndexName: String

    override fun beforeStep(stepExecution: StepExecution) {
        newIndexName = stepExecution.jobExecution.executionContext
            .getString(ReindexJobExecutionListener.NEW_INDEX_NAME_KEY)
    }

    override fun write(chunk: Chunk<out ProductDocument>) {
        chunk.items.forEach { doc ->
            bulkProcessor.processDocument(newIndexName, doc)
        }
    }
}
```

**Step 4: 테스트 — ReindexJobExecutionListenerTest**

`search/batch/src/test/kotlin/com/kgd/search/job/ReindexJobExecutionListenerTest.kt`:

```kotlin
package com.kgd.search.job

import com.kgd.search.infrastructure.indexing.EsBulkDocumentProcessor
import com.kgd.search.infrastructure.indexing.IndexAliasManager
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.*
import org.springframework.batch.core.BatchStatus
import org.springframework.batch.core.JobExecution
import org.springframework.batch.core.JobInstance
import org.springframework.batch.core.JobParameters

class ReindexJobExecutionListenerTest : BehaviorSpec({
    val aliasManager = mockk<IndexAliasManager>()
    val bulkProcessor = mockk<EsBulkDocumentProcessor>()
    val listener = ReindexJobExecutionListener(aliasManager, bulkProcessor, "products")

    beforeEach { clearMocks(aliasManager, bulkProcessor) }

    fun jobExecution(status: BatchStatus = BatchStatus.COMPLETED): JobExecution {
        val instance = JobInstance(1L, "productDbReindexJob")
        return JobExecution(instance, JobParameters()).also { it.status = status }
    }

    given("beforeJob 호출 시") {
        `when`("정상 실행") {
            then("타임스탬프 인덱스를 생성하고 context에 저장한다") {
                every { aliasManager.createTimestampedIndexName("products") } returns "products_20260309120000"
                every { aliasManager.createIndex("products_20260309120000") } just Runs

                val exec = jobExecution()
                listener.beforeJob(exec)

                exec.executionContext.getString(ReindexJobExecutionListener.NEW_INDEX_NAME_KEY) shouldBe "products_20260309120000"
                verify { aliasManager.createIndex("products_20260309120000") }
            }
        }
    }

    given("afterJob 호출 시") {
        `when`("Job이 COMPLETED") {
            then("flush 후 alias swap을 수행한다") {
                every { aliasManager.createTimestampedIndexName("products") } returns "products_20260309120000"
                every { aliasManager.createIndex(any()) } just Runs
                every { bulkProcessor.flush() } just Runs
                every { bulkProcessor.errorCount } returns mockk { every { get() } returns 0L }
                every { aliasManager.updateAliasAndCleanup("products", "products_20260309120000") } just Runs

                val exec = jobExecution(BatchStatus.COMPLETED)
                listener.beforeJob(exec)
                listener.afterJob(exec)

                verify { bulkProcessor.flush() }
                verify { aliasManager.updateAliasAndCleanup("products", "products_20260309120000") }
            }
        }

        `when`("Job이 FAILED") {
            then("alias swap을 수행하지 않는다") {
                val exec = jobExecution(BatchStatus.FAILED)
                exec.executionContext.putString(ReindexJobExecutionListener.NEW_INDEX_NAME_KEY, "products_20260309120000")
                listener.afterJob(exec)

                verify(exactly = 0) { bulkProcessor.flush() }
                verify(exactly = 0) { aliasManager.updateAliasAndCleanup(any(), any()) }
            }
        }
    }
})
```

**Step 5: 테스트 — ProductEsItemWriterTest**

```kotlin
package com.kgd.search.job

import com.kgd.search.domain.product.model.ProductDocument
import com.kgd.search.infrastructure.indexing.EsBulkDocumentProcessor
import io.kotest.core.spec.style.BehaviorSpec
import io.mockk.*
import org.springframework.batch.core.JobExecution
import org.springframework.batch.core.JobInstance
import org.springframework.batch.core.JobParameters
import org.springframework.batch.core.StepExecution
import org.springframework.batch.item.Chunk
import java.math.BigDecimal
import java.time.LocalDateTime

class ProductEsItemWriterTest : BehaviorSpec({
    val bulkProcessor = mockk<EsBulkDocumentProcessor>()
    val writer = ProductEsItemWriter(bulkProcessor)

    beforeEach {
        clearMocks(bulkProcessor)
        // StepExecution을 통해 newIndexName 주입
        val jobExec = JobExecution(JobInstance(1L, "job"), JobParameters())
        jobExec.executionContext.putString(ReindexJobExecutionListener.NEW_INDEX_NAME_KEY, "products_test")
        val stepExec = StepExecution("step", jobExec)
        writer.beforeStep(stepExec)
    }

    given("write 호출 시") {
        `when`("문서 2개가 포함된 Chunk") {
            then("각 문서에 대해 processDocument가 호출된다") {
                every { bulkProcessor.processDocument(any(), any()) } just Runs

                val docs = listOf(
                    ProductDocument("1", "상품A", BigDecimal("1000"), "ACTIVE", LocalDateTime.now()),
                    ProductDocument("2", "상품B", BigDecimal("2000"), "ACTIVE", LocalDateTime.now())
                )
                writer.write(Chunk(docs))

                verify(exactly = 2) { bulkProcessor.processDocument("products_test", any()) }
            }
        }
    }
})
```

**Step 6: 테스트 실행**

```bash
./gradlew :search:batch:test --no-daemon
```

Expected: `BUILD SUCCESSFUL`, 신규 테스트 2개 통과

**Step 7: 커밋**

```bash
git add search/batch/src/main/kotlin/com/kgd/search/job/ProductRow.kt
git add search/batch/src/main/kotlin/com/kgd/search/job/ReindexJobExecutionListener.kt
git add search/batch/src/main/kotlin/com/kgd/search/job/ProductEsItemWriter.kt
git add search/batch/src/test/kotlin/com/kgd/search/job/ReindexJobExecutionListenerTest.kt
git add search/batch/src/test/kotlin/com/kgd/search/job/ProductEsItemWriterTest.kt
git commit -m "feat(search-batch): add ReindexJobExecutionListener and ProductEsItemWriter"
```

---

## Task 6: ProductDbReindexJobConfig — JdbcPagingItemReader 기반 Job

**Files:**
- Create: `search/batch/src/main/kotlin/com/kgd/search/job/ProductDbReindexJobConfig.kt`

**Background:**
`SqlPagingQueryProviderFactoryBean`은 DataSource를 분석해 DB 방언에 맞는 PagingQueryProvider를 자동 생성한다 (MySQL → `MySqlPagingQueryProvider`, H2 → `H2PagingQueryProvider`). 이를 통해 테스트에서 H2로도 동작 가능하다.
`sortKeys`에 `id ASC`를 사용해 keyset 기반 안정 페이지네이션을 보장한다.

**Step 1: ProductDbReindexJobConfig 작성**

```kotlin
package com.kgd.search.job

import com.kgd.search.domain.product.model.ProductDocument
import com.kgd.search.infrastructure.indexing.EsBulkDocumentProcessor
import com.kgd.search.infrastructure.indexing.IndexAliasManager
import org.springframework.batch.core.job.Job
import org.springframework.batch.core.step.Step
import org.springframework.batch.core.job.builder.JobBuilder
import org.springframework.batch.core.repository.JobRepository
import org.springframework.batch.core.step.builder.StepBuilder
import org.springframework.batch.item.ItemProcessor
import org.springframework.batch.item.database.JdbcPagingItemReader
import org.springframework.batch.item.database.Order
import org.springframework.batch.item.database.builder.JdbcPagingItemReaderBuilder
import org.springframework.batch.item.database.support.SqlPagingQueryProviderFactoryBean
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.transaction.PlatformTransactionManager
import javax.sql.DataSource

@Configuration
@ConditionalOnProperty(name = ["reindex.source"], havingValue = "db")
class ProductDbReindexJobConfig(
    private val jobRepository: JobRepository,
    private val transactionManager: PlatformTransactionManager,
    @Qualifier("productDataSource") private val productDataSource: DataSource,
    private val bulkProcessor: EsBulkDocumentProcessor,
    private val aliasManager: IndexAliasManager
) {
    @Value("\${search.index.alias:products}")
    private lateinit var indexAlias: String

    @Value("\${search.batch.page-size:100}")
    private var pageSize: Int = 100

    @Bean
    fun productDbReindexJob(dbReindexStep: Step): Job =
        JobBuilder("productDbReindexJob", jobRepository)
            .listener(ReindexJobExecutionListener(aliasManager, bulkProcessor, indexAlias))
            .start(dbReindexStep)
            .build()

    @Bean
    fun dbReindexStep(): Step =
        StepBuilder("dbReindexStep", jobRepository)
            .chunk<ProductRow, ProductDocument>(pageSize, transactionManager)
            .reader(productJdbcReader())
            .processor(productDocumentProcessor())
            .writer(productEsItemWriter())
            .build()

    @Bean
    fun productJdbcReader(): JdbcPagingItemReader<ProductRow> {
        val provider = SqlPagingQueryProviderFactoryBean().apply {
            setDataSource(productDataSource)
            setSelectClause("SELECT id, name, price, stock, status, created_at")
            setFromClause("FROM products")
            setSortKeys(mapOf("id" to Order.ASCENDING))
        }
        return JdbcPagingItemReaderBuilder<ProductRow>()
            .name("productJdbcReader")
            .dataSource(productDataSource)
            .queryProvider(provider.`object`)
            .pageSize(pageSize)
            .rowMapper { rs, _ ->
                ProductRow(
                    id = rs.getLong("id"),
                    name = rs.getString("name"),
                    price = rs.getBigDecimal("price"),
                    stock = rs.getInt("stock"),
                    status = rs.getString("status"),
                    createdAt = rs.getTimestamp("created_at").toLocalDateTime()
                )
            }
            .build()
    }

    @Bean
    fun productDocumentProcessor(): ItemProcessor<ProductRow, ProductDocument> =
        ItemProcessor { row ->
            ProductDocument(
                id = row.id.toString(),
                name = row.name,
                price = row.price,
                status = row.status,
                createdAt = row.createdAt
            )
        }

    @Bean
    fun productEsItemWriter(): ProductEsItemWriter =
        ProductEsItemWriter(bulkProcessor)
}
```

**Step 2: 빌드 확인**

```bash
./gradlew :search:batch:build -x test --no-daemon
```

Expected: `BUILD SUCCESSFUL`

**Step 3: 커밋**

```bash
git add search/batch/src/main/kotlin/com/kgd/search/job/ProductDbReindexJobConfig.kt
git commit -m "feat(search-batch): add ProductDbReindexJob with JdbcPagingItemReader"
```

---

## Task 7: application-db.yml 프로파일 + application.yml 정리

**Files:**
- Create: `search/batch/src/main/resources/application-db.yml`
- Modify: `search/batch/src/main/resources/application.yml`

**Step 1: application-db.yml 생성**

```yaml
# DB-direct 색인 모드 설정 (reindex.source=db 시 활성화)
product:
  datasource:
    url: jdbc:mysql://${PRODUCT_DB_HOST:localhost}:${PRODUCT_DB_PORT:3317}/product_db?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC&rewriteBatchedStatements=true
    username: ${PRODUCT_DB_USER:${MYSQL_USER}}
    password: ${PRODUCT_DB_PASSWORD:${MYSQL_PASSWORD}}
```

**Step 2: application.yml에 reindex.source 설명 주석 추가**

기존 `application.yml`에 아래 항목 추가:

```yaml
# 색인 소스 선택: api(기본) | db
# api: Product REST API를 통해 소싱 (서비스 경계 준수, 운영 중 사용)
# db: mysql-product-replica 직접 리드 (ADR-0009 예외, 초기 색인/DR 복구)
reindex:
  source: ${REINDEX_SOURCE:api}
```

**Step 3: 빌드 확인**

```bash
./gradlew :search:batch:build -x test --no-daemon
```

**Step 4: 커밋**

```bash
git add search/batch/src/main/resources/application-db.yml
git add search/batch/src/main/resources/application.yml
git commit -m "config(search-batch): add application-db.yml profile and reindex.source property"
```

---

## Task 8: docker-compose.yml 업데이트

**Files:**
- Modify: `docker/docker-compose.yml`
- Modify: `docker/.env.example`

**Step 1: search-batch 서비스에 DB 환경변수 추가**

`docker/docker-compose.yml`의 `search-batch` 서비스:

```yaml
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
      REINDEX_SOURCE: ${REINDEX_SOURCE:-api}            # api | db
      PRODUCT_DB_HOST: mysql-product-replica            # db 모드 전용
      PRODUCT_DB_PORT: 3306
      PRODUCT_DB_USER: ${MYSQL_USER}
      PRODUCT_DB_PASSWORD: ${MYSQL_PASSWORD}
    depends_on:
      discovery:
        condition: service_healthy
      elasticsearch:
        condition: service_healthy
      product:
        condition: service_healthy                      # service_started → service_healthy 로 강화
      mysql-product-replica:
        condition: service_healthy                      # db 모드 전용 (api 모드에서도 무해함)
    networks:
      commerce-network:
        ipv4_address: 172.20.0.52
    restart: unless-stopped
```

**Step 2: .env.example에 항목 추가**

```bash
# search-batch 색인 소스 (api | db)
REINDEX_SOURCE=api
```

**Step 3: 빌드 확인**

```bash
docker compose -f docker/docker-compose.yml config --quiet
```

Expected: 오류 없음

**Step 4: 커밋**

```bash
git add docker/docker-compose.yml docker/.env.example
git commit -m "config(docker): add DB-direct reindex env vars to search-batch"
```

---

## Task 9: CDC 파이프라인 확장 문서 작성

**Files:**
- Create: `docs/architecture/cdc-pipeline.md`

**Step 1: CDC 파이프라인 문서 작성**

```markdown
# CDC 파이프라인 확장 가이드

## 개요

CDC(Change Data Capture)는 DB 바이너리 로그(binlog)를 실시간으로 읽어
변경 이벤트를 Kafka로 스트리밍하는 기법이다.
현재 search-batch의 DB 직접 리드 방식(ADR-0009)을 대체하거나 보완할 수 있다.

## 현재 아키텍처와의 비교

| 항목 | Kafka 애플리케이션 이벤트 (현재) | DB 직접 리드 (ADR-0009) | CDC (확장) |
|------|-------------------------------|------------------------|-----------|
| 데이터 완전성 | 코드 누락 시 이벤트 손실 가능 | DB 그대로 읽음 | DB 변경 전량 캡처 |
| 실시간성 | ms 단위 | 배치 스케줄 주기 | ms~초 단위 |
| 서비스 경계 | 준수 | 예외 허용 | 준수 (Kafka 경유) |
| 운영 복잡도 | 낮음 | 낮음 | 높음 (Kafka Connect 운영 필요) |
| 스키마 결합도 | 느슨 | 높음 (테이블 직접 참조) | 높음 (binlog 컬럼 참조) |

## 권장 도입 시점

- 상품 수가 수천만 건 이상으로 증가해 배치 색인 주기가 성능 병목이 될 때
- 실시간 검색 반영이 SLA 요구사항이 될 때 (현재는 Eventual Consistency 허용)
- Kafka Connect 인프라가 이미 운영되고 있을 때

## 구성 요소

```
MySQL (product_db) ──binlog──► Debezium MySQL Connector
                                      │ (Kafka Connect)
                                      ▼
                          Kafka Topic: dbz.commerce.products
                                      │
                          ┌───────────┴───────────┐
                          ▼                       ▼
                 search-consumer           search-batch
              (실시간 증분 색인)         (초기/전체 색인)
```

## Debezium MySQL Connector 설정 예시

`docker/kafka-connect/debezium-product-connector.json`:

```json
{
  "name": "product-mysql-connector",
  "config": {
    "connector.class": "io.debezium.connector.mysql.MySqlConnector",
    "tasks.max": "1",
    "database.hostname": "mysql-product-replica",
    "database.port": "3306",
    "database.user": "${PRODUCT_DB_USER}",
    "database.password": "${PRODUCT_DB_PASSWORD}",
    "database.server.id": "1001",
    "database.include.list": "product_db",
    "table.include.list": "product_db.products",
    "topic.prefix": "dbz",
    "schema.history.internal.kafka.bootstrap.servers": "kafka:29092",
    "schema.history.internal.kafka.topic": "schema-changes.product",
    "include.schema.changes": "false",
    "snapshot.mode": "initial",
    "transforms": "unwrap",
    "transforms.unwrap.type": "io.debezium.transforms.ExtractNewRecordState",
    "transforms.unwrap.drop.tombstones": "false",
    "transforms.unwrap.delete.handling.mode": "rewrite"
  }
}
```

## Kafka 토픽 이벤트 구조

Debezium이 발행하는 `dbz.commerce.products` 토픽 메시지:

```json
{
  "id": 42,
  "name": "상품명",
  "price": 15000.00,
  "stock": 100,
  "status": "ACTIVE",
  "created_at": 1741478400000,
  "__deleted": "false"      // ExtractNewRecordState 적용 후
}
```

`__deleted: "true"` 이면 ES에서 해당 문서 삭제 처리 필요.

## search-consumer 확장 방안

현재 `search-consumer`는 애플리케이션 이벤트(`product.item.created`, `product.item.updated`)를 처리한다.
CDC 이벤트를 처리하는 Consumer를 추가하거나, 기존 Consumer를 대체할 수 있다.

### 옵션 A: CDC Consumer 병행 운영
- `product.item.*` 토픽 (애플리케이션 이벤트) — 기존 유지
- `dbz.commerce.products` 토픽 (CDC) — 신규 Consumer 추가
- 장점: 점진적 마이그레이션 가능
- 단점: 중복 처리 가능성, Consumer 관리 복잡

### 옵션 B: CDC Consumer로 완전 교체
- 애플리케이션 이벤트 발행 코드 제거 (product 서비스 단순화)
- 단점: 운영 복잡도 증가 (Kafka Connect 인프라 추가 필요)

## 도입 전 필수 인프라

1. **Kafka Connect 클러스터** (`confluentinc/cp-kafka-connect` 또는 `debezium/connect`)
2. **MySQL binlog 활성화** (`my.cnf`: `log_bin=ON`, `binlog_format=ROW`, `binlog_row_image=FULL`)
3. **Debezium MySQL Connector 플러그인** (Kafka Connect에 설치)
4. **Schema Registry** (선택 사항, Avro 직렬화 사용 시)

MySQL binlog는 `mysql-product-master`에서만 활성화하면 된다 (replica는 master에서 복제).

## 구현 우선순위 제안

현재 단계에서는 다음 순서로 도입을 검토한다:

1. **현재 (완료)**: 애플리케이션 이벤트 + API 배치 / DB 직접 배치
2. **단기**: MySQL binlog 활성화 + Debezium 테스트 환경 구성
3. **중기**: search-consumer에 CDC 이벤트 처리 추가 (병행 운영)
4. **장기**: 완전 CDC 전환 (Kafka Connect 운영 안정화 후)
```

**Step 2: 커밋**

```bash
git add docs/architecture/cdc-pipeline.md
git commit -m "docs: add CDC pipeline architecture guide for search indexing"
```

---

## Task 10: 전체 빌드 + 검증

**Step 1: 전체 빌드**

```bash
./gradlew build --no-daemon
```

Expected: `BUILD SUCCESSFUL`

**Step 2: API 모드 단위 테스트만 실행**

```bash
./gradlew :search:batch:test --no-daemon
```

Expected: `BUILD SUCCESSFUL`, 모든 테스트 통과

**Step 3: 최종 커밋 없음**

개별 Task에서 이미 커밋됨.

---

## 검증 체크리스트

- [ ] `ADR-0009` 파일 존재 (`docs/adr/ADR-0009-search-batch-db-direct-access.md`)
- [ ] `reindex.source=api` (기본값): `productApiReindexJob` 만 활성화됨
- [ ] `reindex.source=db`: `productDbReindexJob` 만 활성화됨
- [ ] `ProductDbReindexJobConfig` — `productDataSource` Bean 사용, H2 primary DataSource 불간섭
- [ ] `JdbcPagingItemReader` — `id ASC` sort key로 안정 페이지네이션
- [ ] `ReindexJobExecutionListenerTest` — beforeJob/afterJob COMPLETED/FAILED 시나리오
- [ ] `ProductEsItemWriterTest` — processDocument 호출 검증
- [ ] `docker-compose.yml` — search-batch에 `REINDEX_SOURCE`, `PRODUCT_DB_*` 환경변수 추가
- [ ] `docs/architecture/cdc-pipeline.md` — CDC 파이프라인 확장 문서 존재

---

## 환경별 사용 방법

### 로컬 API 모드 (기본, 기존 동일)
```bash
# Product 서비스 기동 후
./gradlew :search:batch:bootRun
```

### 로컬 DB 모드
```bash
# mysql-product-replica 기동 후
REINDEX_SOURCE=db \
SPRING_PROFILES_ACTIVE=db \
PRODUCT_DB_HOST=localhost \
PRODUCT_DB_PORT=3317 \
MYSQL_USER=your_user \
MYSQL_PASSWORD=your_pass \
./gradlew :search:batch:bootRun
```

### Docker DB 모드
```bash
# docker/.env에 REINDEX_SOURCE=db 설정 후
docker compose -f docker/docker-compose.yml up search-batch
```
