package com.kgd.search.job

import com.kgd.search.domain.product.model.ProductDocument
import com.kgd.search.infrastructure.client.ProductApiClient
import com.kgd.search.infrastructure.indexing.EsBulkDocumentProcessor
import com.kgd.search.infrastructure.indexing.IndexAliasManager
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.clearMocks
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import java.math.BigDecimal

class ProductReindexTaskletTest : BehaviorSpec({
    val productApiClient = mockk<ProductApiClient>()
    val bulkProcessor = mockk<EsBulkDocumentProcessor>(relaxed = true)
    val aliasManager = mockk<IndexAliasManager>(relaxed = true)

    fun createTasklet(): ProductReindexTasklet {
        val tasklet = ProductReindexTasklet(productApiClient, bulkProcessor, aliasManager)
        tasklet.javaClass.getDeclaredField("indexAlias").apply {
            isAccessible = true
            set(tasklet, "products")
        }
        tasklet.javaClass.getDeclaredField("pageSize").apply {
            isAccessible = true
            setInt(tasklet, 100)
        }
        return tasklet
    }

    beforeEach {
        clearMocks(productApiClient, bulkProcessor, aliasManager)
        every { aliasManager.createTimestampedIndexName(any()) } returns "products_20260309120000"
    }

    given("전체 색인 실행 시") {
        `when`("상품이 1페이지에 모두 들어오면") {
            then("모든 상품을 색인하고 alias를 교체해야 한다") {
                coEvery { productApiClient.fetchPage(0, 100) } returns ProductApiClient.ProductPageResponse(
                    products = listOf(
                        ProductApiClient.ProductDto(1L, "상품A", BigDecimal("1000"), "ACTIVE", 10)
                    ),
                    totalElements = 1L,
                    totalPages = 1
                )

                val docSlot = slot<ProductDocument>()
                every { bulkProcessor.processDocument("products_20260309120000", capture(docSlot)) } returns Unit

                createTasklet().execute(mockk(relaxed = true), mockk(relaxed = true))

                docSlot.captured.id shouldBe "1"
                docSlot.captured.name shouldBe "상품A"
                verify(exactly = 1) { bulkProcessor.flush() }
                verify(exactly = 1) { aliasManager.updateAliasAndCleanup("products", "products_20260309120000") }
            }
        }

        `when`("상품이 2페이지에 걸쳐 있으면") {
            then("모든 페이지를 순서대로 처리해야 한다") {
                coEvery { productApiClient.fetchPage(0, 100) } returns ProductApiClient.ProductPageResponse(
                    products = listOf(ProductApiClient.ProductDto(1L, "상품A", BigDecimal("1000"), "ACTIVE", 5)),
                    totalElements = 2L,
                    totalPages = 2
                )
                coEvery { productApiClient.fetchPage(1, 100) } returns ProductApiClient.ProductPageResponse(
                    products = listOf(ProductApiClient.ProductDto(2L, "상품B", BigDecimal("2000"), "ACTIVE", 3)),
                    totalElements = 2L,
                    totalPages = 2
                )

                createTasklet().execute(mockk(relaxed = true), mockk(relaxed = true))

                verify(exactly = 2) { bulkProcessor.processDocument(any(), any()) }
                verify(exactly = 1) { aliasManager.updateAliasAndCleanup(any(), any()) }
            }
        }
    }
})
