package com.kgd.search.infrastructure.indexing

import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper
import io.github.oshai.kotlinlogging.KotlinLogging
import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.opensearch.core.CountRequest
import org.opensearch.client.opensearch.generic.Requests
import org.springframework.stereotype.Component
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

@Component
class IndexAliasManager(private val osClient: OpenSearchClient) {

    private val log = KotlinLogging.logger {}
    private val timestampFormatter = DateTimeFormatter.ofPattern("yyyyMMddHHmmss")

    /** 정의 리소스에 settings·mappings 가 있는지만 본다 — 보내는 것은 원문 그대로다. */
    private val jsonChecker = ObjectMapper()

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
     * ADR-0055 — 정의는 `opensearch/` 아래 색인별 JSON 리소스 하나이고, **원문 그대로** 보낸다.
     * typed `IndexSettings` 로 파싱해 보내면 클라이언트 모델에 없는 키가 말없이 빠진다 —
     * `synonym_graph.synonym_analyzer` 가 빠져 서버에서 동의어 해석이 실패했다(색인 생성 400).
     */
    fun createIndex(indexName: String, definitionResource: String = PRODUCTS_INDEX_DEFINITION) {
        val definition = loadIndexDefinition(definitionResource)
        val request = Requests.builder().method("PUT").endpoint("/$indexName").json(definition).build()
        osClient.generic().execute(request).use { response ->
            check(response.status in 200..299) {
                "색인 생성 실패 $indexName — ${response.status} ${response.body.map { it.bodyAsString() }.orElse("")}"
            }
        }
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

    private fun loadIndexDefinition(definitionResource: String): String {
        val stream = requireNotNull(javaClass.getResourceAsStream(definitionResource)) {
            "Index definition resource not found: $definitionResource"
        }
        val text = stream.use { it.readBytes().toString(Charsets.UTF_8) }
        val tree: JsonNode = jsonChecker.readTree(text)
        listOf("settings", "mappings").forEach { key ->
            requireNotNull(tree.get(key)) { "'$key' 누락 — 인덱스 정의 리소스 확인" }
        }
        return text
    }
}
