package com.kgd.search.infrastructure.indexing

import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper
import io.github.oshai.kotlinlogging.KotlinLogging
import org.opensearch.client.json.JsonpDeserializer
import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.opensearch._types.mapping.TypeMapping
import org.opensearch.client.opensearch.core.CountRequest
import org.opensearch.client.opensearch.indices.CreateIndexRequest
import org.opensearch.client.opensearch.indices.IndexSettings
import org.springframework.stereotype.Component
import java.io.StringReader
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

@Component
class IndexAliasManager(private val osClient: OpenSearchClient) {

    private val log = KotlinLogging.logger {}
    private val timestampFormatter = DateTimeFormatter.ofPattern("yyyyMMddHHmmss")

    // 리소스 JSON 을 settings/mappings 로 쪼개기 위한 로컬 파서.
    // 클라이언트 mapper 의 jsonProvider().createReader(DOM) 는 opensearch-java 3.8 의
    // JacksonJsonProvider 가 UnsupportedOperationException 을 던져 사용 불가 (로컬 E2E 확인)
    // — 스트리밍 createParser 경로만 지원되므로 분해는 Jackson 트리로 수행한다.
    private val jsonSplitter = ObjectMapper()

    companion object {
        /** settings/mappings 의 SSOT (ADR-0055) — nori 분석기 + 필드 매핑 전체. */
        const val PRODUCTS_INDEX_DEFINITION = "/opensearch/products-index.json"

        /** 새 색인이 라이브 건수의 이 비율 밑이면 별칭을 넘기지 않는다. 하룻밤 원천이 10% 넘게 줄면 사람이 볼 일이다. */
        const val MIN_DOC_RATIO = 0.9

        /** 관광지 인덱스 정의 (ADR-0065) — nori + english 서브필드 + geo_point. */
        const val ATTRACTIONS_INDEX_DEFINITION = "/opensearch/attractions-index.json"

        /** 행정 지역 인덱스 정의 (ADR-0065 통합 자동완성) — nameKo nori + population. */
        const val REGIONS_INDEX_DEFINITION = "/opensearch/regions-index.json"

        /** ADR-0090 D6 — 관광지를 뺀 타입들의 통합 인덱스 */
        const val UNIFIED_INDEX_DEFINITION = "/opensearch/unified-index.json"
    }

    /** 새 타임스탬프 색인명 생성: products_20260309120000 */
    fun createTimestampedIndexName(alias: String): String =
        "${alias}_${LocalDateTime.now().format(timestampFormatter)}"

    /**
     * OpenSearch에 새 색인 생성 (nori 분석기 + 기본 매핑).
     *
     * ADR-0055 — 정의는 `opensearch/products-index.json` 단일 JSON 리소스.
     * opensearch-java 3.x 의 `CreateIndexRequest.Builder` 에는 withJson 이 없어
     * settings/mappings 를 각각 `_DESERIALIZER` 로 파싱해 typed builder 에 주입한다.
     */
    fun createIndex(indexName: String, definitionResource: String = PRODUCTS_INDEX_DEFINITION) {
        val definition = loadIndexDefinition(definitionResource)
        val settings = definition.required("settings").parseAs(IndexSettings._DESERIALIZER)
        val mappings = definition.required("mappings").parseAs(TypeMapping._DESERIALIZER)

        val request = CreateIndexRequest.Builder()
            .index(indexName)
            .settings(settings)
            .mappings(mappings)
            .build()
        osClient.indices().create(request)
        log.info { "Created index: $indexName" }
    }

    /**
     * alias를 newIndexName으로 atomic 교체하고, 이름 prefix 로 전체 timestamped 인덱스를 스캔해
     * 최신 maxRetention 개를 제외한 옛 인덱스를 삭제.
     *
     * **교체 전에 새 색인의 건수를 지금 라이브 색인과 견준다.** 새 색인이 비었거나 라이브의
     * [MIN_DOC_RATIO] 에 못 미치면 새 색인을 지우고 예외를 던진다 — 별칭은 그대로 남는다.
     * 색인 도중 OpenSearch 가 OOM 으로 재시작되면 벌크가 수천 건 실패한 채로도 잡은 끝까지 가고,
     * 게이트가 없던 때는 45,535 / 59,735 건짜리 색인이 그대로 라이브가 됐다. 검사를 호출자가 아니라
     * 이 함수 안에 둔 이유는 교체 경로가 여기 하나뿐이라 어느 잡도 건너뛸 수 없게 하려는 것이다.
     */
    fun updateAliasAndCleanup(alias: String, newIndexName: String, maxRetention: Int = 2) {
        val aliasedIndices = getIndicesForAlias(alias)
        checkNewIndexComplete(alias, newIndexName, aliasedIndices)

        osClient.indices().updateAliases { req ->
            // opensearch-java: actions(Function<Builder, ObjectBuilder<Action>>) 는 단건 액션 빌더.
            // 여러 액션을 등록하려면 매 액션마다 .actions{} 를 별도 호출해야 함.
            aliasedIndices.forEach { oldIndex ->
                req.actions { a -> a.remove { r -> r.index(oldIndex).alias(alias) } }
            }
            req.actions { a -> a.add { ad -> ad.index(newIndexName).alias(alias) } }
            req
        }
        log.info { "Alias '$alias' → '$newIndexName' (removed ${aliasedIndices.size} old)" }

        // 이름 prefix 기반 전체 스캔 — alias 가 빠진 옛 인덱스도 retention 정리
        val allTimestamped = listIndicesByPrefix("${alias}_")
        allTimestamped
            .sortedDescending()
            .drop(maxRetention)
            .forEach { oldIndex ->
                osClient.indices().delete { d -> d.index(oldIndex) }
                log.info { "Deleted old index: $oldIndex" }
            }
    }

    private fun checkNewIndexComplete(alias: String, newIndexName: String, liveIndices: List<String>) {
        osClient.indices().refresh { it.index(newIndexName) }
        val newCount = countDocs(newIndexName)
        val liveCount = liveIndices.filter { it != newIndexName }.sumOf { countDocs(it) }
        val floor = (liveCount * MIN_DOC_RATIO).toLong()
        if (newCount == 0L || newCount < floor) {
            runCatching { osClient.indices().delete { d -> d.index(newIndexName) } }
            error(
                "별칭 '$alias' 교체 거부 — 새 색인 $newIndexName 이 $newCount 건으로 라이브 $liveCount 건의 " +
                    "${(MIN_DOC_RATIO * 100).toInt()}% ($floor 건)에 못 미친다. 새 색인은 지웠고 라이브는 그대로다",
            )
        }
        log.info { "Alias '$alias' 교체 검사 통과 — 새 $newCount 건 / 라이브 $liveCount 건" }
    }

    private fun countDocs(index: String): Long =
        osClient.count(CountRequest.of { it.index(index) }).count()

    private fun getIndicesForAlias(alias: String): List<String> =
        runCatching {
            osClient.indices().getAlias { it.name(alias) }.result().keys.toList()
        }.getOrElse { emptyList() }

    private fun listIndicesByPrefix(prefix: String): List<String> =
        runCatching {
            osClient.indices().get { it.index("${prefix}*") }.result().keys.toList()
        }.getOrElse { emptyList() }

    private fun loadIndexDefinition(definitionResource: String): JsonNode {
        val stream = requireNotNull(javaClass.getResourceAsStream(definitionResource)) {
            "Index definition resource not found: $definitionResource"
        }
        return stream.use { jsonSplitter.readTree(it) }
    }

    private fun JsonNode.required(key: String): JsonNode =
        requireNotNull(get(key)) { "'$key' 누락 — 인덱스 정의 리소스 확인" }

    private fun <T> JsonNode.parseAs(deserializer: JsonpDeserializer<T>): T {
        val mapper = osClient._transport().jsonpMapper()
        return mapper.jsonProvider().createParser(StringReader(toString())).use { parser ->
            deserializer.deserialize(parser, mapper)
        }
    }
}
