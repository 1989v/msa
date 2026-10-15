package com.kgd.search.infrastructure.opensearch

import com.kgd.search.application.attraction.port.AttractionLtrFeaturePort
import com.kgd.search.application.attraction.port.LtrRetrievalFeatures
import com.kgd.search.application.queryvector.config.QueryVectorProperties
import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.opensearch.generic.Body
import org.opensearch.client.opensearch.generic.Requests
import org.springframework.stereotype.Component
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper

/**
 * LTR 피처를 한 번의 `_msearch` 로 받는다. 질의 일곱 개의 모양은 학습 피처를 뽑은 스크립트와 **바이트 단위로 같은 뜻**이어야 한다 —
 * BM25 단독·벡터 레그는 `live-eval.py` 의 `ids_bm25`·`ids_hybrid`, 필드별 점수는 `features.sh` 그대로다.
 * 앱의 키워드 레그(분류 가중치·클릭 계수)와 다르게 날것의 질의를 쓰는 것이 맞다 — 모델이 그 값으로 배웠다.
 */
@Component
class AttractionLtrFeatureAdapter(
    private val client: OpenSearchClient,
    private val objectMapper: ObjectMapper,
    private val queryVector: QueryVectorProperties,
) : AttractionLtrFeaturePort {

    override fun features(keyword: String, lang: String, vector: List<Float>, candidateIds: List<String>): Map<String, LtrRetrievalFeatures> {
        val body = requestBody(keyword, lang, vector, candidateIds)
        val request = Requests.builder()
            .method("POST")
            .endpoint("/${AttractionSearchAdapter.INDEX}/_msearch")
            .body(Body.from(body.toByteArray(), "application/x-ndjson"))
            .build()
        val json = client.generic().execute(request).use { response ->
            val text = response.body.map { it.bodyAsString() }.orElse("")
            check(response.status in 200..299) { "LTR 피처 msearch 실패 ${response.status} ${text.take(300)}" }
            text
        }
        return parse(objectMapper.readTree(json), candidateIds)
    }

    internal fun requestBody(keyword: String, lang: String, vector: List<Float>, candidateIds: List<String>): String {
        val langFilter = listOf(term("lang", lang))
        val searches = listOf(
            // A: BM25 단독 상위 20 — 순위 피처이자 B 의 키워드 레그
            mapOf("size" to RANK_DEPTH, "_source" to false, "query" to mapOf("bool" to mapOf("must" to listOf(multiMatch(keyword, FIELDS)), "filter" to langFilter))),
            // 벡터 이웃 100 — 앞 20 이 B 의 벡터 레그, 점수는 knn 피처
            mapOf(
                "size" to KNN_K, "_source" to false,
                "query" to mapOf("knn" to mapOf("embedding" to mapOf(
                    "vector" to vector, "k" to KNN_K,
                    "filter" to mapOf("bool" to mapOf("filter" to langFilter + term("embeddingModel", queryVector.modelRef))),
                ))),
            ),
            scoring(multiMatch(keyword, TITLE_FIELDS), candidateIds),
            scoring(multiMatch(keyword, OVERVIEW_FIELDS), candidateIds),
            scoring(multiMatch(keyword, ADDRESS_FIELDS), candidateIds),
            scoring(multiMatch(keyword, FIELDS), candidateIds),
            scoring(multiMatch(keyword, TITLE_FIELDS, type = "phrase"), candidateIds),
        )
        return buildString { searches.forEach { append("{}\n").append(objectMapper.writeValueAsString(it)).append('\n') } }
    }

    private fun parse(root: JsonNode, candidateIds: List<String>): Map<String, LtrRetrievalFeatures> {
        val responses = root.path("responses")
        check(responses.size() == SEARCH_COUNT) { "msearch 응답 ${responses.size()}개 — $SEARCH_COUNT 개를 보냈다" }
        responses.items().forEachIndexed { i, r -> check(!r.has("error")) { "msearch $i 번 실패: ${r.path("error").path("reason").asString()}" } }
        fun ids(i: Int) = responses[i].path("hits").path("hits").items().map { it.path("_id").asString() }
        fun scores(i: Int) = responses[i].path("hits").path("hits").items().associate { it.path("_id").asString() to it.path("_score").asDouble() }
        val bm25 = ids(0)
        val knnHits = responses[1].path("hits").path("hits").items()
        val knn = knnHits.associate { it.path("_id").asString() to it.path("_score").asDouble() }
        val hybrid = rrf(bm25, knnHits.take(RANK_DEPTH).map { it.path("_id").asString() })
        val (title, overview, address, all, phrase) = (2..6).map { scores(it) }
        return candidateIds.associateWith { id ->
            LtrRetrievalFeatures(
                aRank = rank(bm25, id),
                bRank = rank(hybrid, id),
                bmTitle = title[id] ?: 0.0,
                bmOverview = overview[id] ?: 0.0,
                bmAddress = address[id] ?: 0.0,
                bmAll = all[id] ?: 0.0,
                phraseTitle = phrase[id] ?: 0.0,
                knn = knn[id] ?: 0.0,
            )
        }
    }

    private fun scoring(query: Map<String, Any>, ids: List<String>) = mapOf(
        "size" to ids.size, "_source" to false,
        "query" to mapOf("bool" to mapOf("must" to listOf(query), "filter" to listOf(mapOf("ids" to mapOf("values" to ids))))),
    )

    companion object {
        /** `live-eval.py` 의 FIELDS 와 같다 */
        private val FIELDS = listOf("title^3", "title.en^3", "titleLocal^3", "overview", "overview.en", "address", "address.en")
        private val TITLE_FIELDS = listOf("title", "title.en", "titleLocal")
        private val OVERVIEW_FIELDS = listOf("overview", "overview.en")
        private val ADDRESS_FIELDS = listOf("address", "address.en")
        private const val RANK_DEPTH = LtrRetrievalFeatures.ABSENT_RANK
        private const val KNN_K = 100
        private const val SEARCH_COUNT = 7

        /** 파이프라인 없이 `live-eval.py` 와 같은 상수로 합친다 */
        private const val RRF_K = 60

        private fun term(field: String, value: String) = mapOf("term" to mapOf(field to value))

        private fun multiMatch(query: String, fields: List<String>, type: String? = null): Map<String, Any> =
            mapOf("multi_match" to buildMap { put("query", query); put("fields", fields); type?.let { put("type", it) } })

        internal fun rrf(a: List<String>, b: List<String>): List<String> {
            val score = LinkedHashMap<String, Double>()
            for (list in listOf(a, b)) list.forEachIndexed { i, id -> score[id] = (score[id] ?: 0.0) + 1.0 / (RRF_K + i + 1) }
            // 파이썬 sorted 는 안정 정렬 — 동점은 먼저 들어온 순서
            return score.entries.sortedByDescending { it.value }.map { it.key }.take(RANK_DEPTH)
        }

        private fun JsonNode.items(): List<JsonNode> = (0 until size()).map { get(it) }

        private fun rank(list: List<String>, id: String) = list.indexOf(id).let { if (it < 0) RANK_DEPTH else it }
    }
}
