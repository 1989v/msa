package com.kgd.search.infrastructure.indexing

import co.elastic.clients.elasticsearch.ElasticsearchClient
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldStartWith
import io.mockk.clearMocks
import io.mockk.mockk

class IndexAliasManagerTest : BehaviorSpec({
    val esClient = mockk<ElasticsearchClient>(relaxed = true)
    val manager = IndexAliasManager(esClient)

    beforeEach { clearMocks(esClient) }

    given("타임스탬프 색인명 생성 시") {
        `when`("alias 이름이 주어지면") {
            then("alias_YYYYMMDDHHMMSS 형식이어야 한다") {
                val name = manager.createTimestampedIndexName("products")
                name shouldStartWith "products_"
                // "products_" = 9 chars, timestamp = 14 chars
                name.length shouldBe 9 + 14
            }
        }
    }

    given("두 번 색인명을 생성하면") {
        `when`("같은 alias로 호출하면") {
            then("각 이름은 같거나 다를 수 있지만 형식은 동일해야 한다") {
                val name1 = manager.createTimestampedIndexName("products")
                val name2 = manager.createTimestampedIndexName("products")
                name1 shouldStartWith "products_"
                name2 shouldStartWith "products_"
            }
        }
    }
})
