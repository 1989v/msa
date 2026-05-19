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
                   // ADR-0043 — Bandit arm 키. legacy doc 에 없을 수 있어 nullable.
                   m.properties("categoryId") { p -> p.keyword { it } }
                   m.properties("popularityScore") { p -> p.double_ { it } }
                   m.properties("ctr") { p -> p.double_ { it } }
                   m.properties("cvr") { p -> p.double_ { it } }
                   // ADR-0050 Phase 2 — raw 디버그 값 + GMV signal
                   m.properties("ctrRaw") { p -> p.double_ { it } }
                   m.properties("cvrRaw") { p -> p.double_ { it } }
                   m.properties("gmv7d") { p -> p.double_ { it } }
                   m.properties("gmv30d") { p -> p.double_ { it } }
                   m.properties("scoreUpdatedAt") { p -> p.long_ { it } }
               }
        }
        log.info("Created index: {}", indexName)
    }

    /**
     * alias를 newIndexName으로 atomic 교체하고, 이름 prefix 로 전체 timestamped 인덱스를 스캔해
     * 최신 maxRetention 개를 제외한 옛 인덱스를 삭제.
     */
    fun updateAliasAndCleanup(alias: String, newIndexName: String, maxRetention: Int = 2) {
        val aliasedIndices = getIndicesForAlias(alias)

        esClient.indices().updateAliases { req ->
            // ES Java client: actions(Function<Builder, ObjectBuilder<Action>>) 는 단건 액션 빌더.
            // 여러 액션을 등록하려면 매 액션마다 .actions{} 를 별도 호출해야 함.
            aliasedIndices.forEach { oldIndex ->
                req.actions { a -> a.remove { r -> r.index(oldIndex).alias(alias) } }
            }
            req.actions { a -> a.add { ad -> ad.index(newIndexName).alias(alias) } }
            req
        }
        log.info("Alias '{}' → '{}' (removed {} old)", alias, newIndexName, aliasedIndices.size)

        // 이름 prefix 기반 전체 스캔 — alias 가 빠진 옛 인덱스도 retention 정리
        val allTimestamped = listIndicesByPrefix("${alias}_")
        allTimestamped
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

    private fun listIndicesByPrefix(prefix: String): List<String> =
        runCatching {
            esClient.indices().get { it.index("${prefix}*") }.indices().keys.toList()
        }.getOrElse { emptyList() }
}
