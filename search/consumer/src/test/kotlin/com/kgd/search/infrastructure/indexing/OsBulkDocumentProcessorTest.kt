package com.kgd.search.infrastructure.indexing

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.clearMocks
import io.mockk.mockk
import org.opensearch.client.opensearch.OpenSearchClient

class OsBulkDocumentProcessorTest : BehaviorSpec({
    val osClient = mockk<OpenSearchClient>(relaxed = true)
    lateinit var processor: OsBulkDocumentProcessor

    beforeEach {
        clearMocks(osClient)
        processor = OsBulkDocumentProcessor(osClient)
    }

    given("OsBulkDocumentProcessor 초기화 후") {
        `when`("카운터를 확인하면") {
            then("processedCount와 errorCount는 0이어야 한다") {
                processor.processedCount.get() shouldBe 0
                processor.errorCount.get() shouldBe 0
            }
        }
    }
})
