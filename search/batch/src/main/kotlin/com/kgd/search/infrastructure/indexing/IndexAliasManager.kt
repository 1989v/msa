package com.kgd.search.infrastructure.indexing

import co.elastic.clients.elasticsearch.ElasticsearchClient
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

    /** Elasticsearch에 새 색인 생성 (nori 분석기 + 기본 매핑) */
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
     * alias를 newIndexName으로 교체하고, 이전 색인 중 maxRetention 초과분을 삭제.
     */
    fun updateAliasAndCleanup(alias: String, newIndexName: String, maxRetention: Int = 2) {
        val existingIndices = getIndicesForAlias(alias)

        esClient.indices().updateAliases { req ->
            req.actions { action ->
                existingIndices.forEach { oldIndex ->
                    action.remove { r -> r.index(oldIndex).alias(alias) }
                }
                action.add { a -> a.index(newIndexName).alias(alias) }
            }
        }
        log.info("Alias '{}' → '{}'", alias, newIndexName)

        existingIndices
            .sortedDescending()
            .drop(maxRetention)
            .forEach { oldIndex ->
                esClient.indices().delete { d -> d.index(oldIndex) }
                log.info("Deleted old index: {}", oldIndex)
            }
    }

    private fun getIndicesForAlias(alias: String): List<String> =
        runCatching {
            esClient.indices().getAlias { it.name(alias) }.aliases().keys.toList()
        }.getOrElse { emptyList() }
}
