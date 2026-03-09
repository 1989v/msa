package com.kgd.search.infrastructure.indexing

import co.elastic.clients.elasticsearch.ElasticsearchClient
import com.fasterxml.jackson.databind.ObjectMapper
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.clearMocks
import io.mockk.mockk

class EsBulkDocumentProcessorTest : BehaviorSpec({
    val esClient = mockk<ElasticsearchClient>(relaxed = true)
    val objectMapper = ObjectMapper()
    lateinit var processor: EsBulkDocumentProcessor

    beforeEach {
        clearMocks(esClient)
        processor = EsBulkDocumentProcessor(esClient, objectMapper)
        processor.init()
    }

    afterEach {
        processor.destroy()
    }

    given("EsBulkDocumentProcessor 초기화 후") {
        `when`("카운터를 확인하면") {
            then("processedCount와 errorCount는 0이어야 한다") {
                processor.processedCount.get() shouldBe 0
                processor.errorCount.get() shouldBe 0
            }
        }
    }
})
