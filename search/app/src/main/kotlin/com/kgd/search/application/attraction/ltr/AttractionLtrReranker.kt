package com.kgd.search.application.attraction.ltr

import com.kgd.search.application.attraction.config.AttractionLtrProperties
import com.kgd.search.application.attraction.port.AttractionLtrFeaturePort
import com.kgd.search.application.attraction.port.LtrRetrievalFeatures
import com.kgd.search.domain.attraction.model.AttractionDocument
import com.kgd.search.domain.attraction.port.AttractionSearchPort.AttractionHit
import io.github.oshai.kotlinlogging.KotlinLogging
import io.micrometer.core.instrument.MeterRegistry
import org.springframework.core.io.ClassPathResource
import org.springframework.stereotype.Component
import tools.jackson.databind.ObjectMapper
import java.util.Locale

/**
 * 하이브리드 결과 상위 [AttractionLtrProperties.depth] 건을 LTR 점수로 다시 줄 세운다.
 *
 * 피처는 학습 행과 **같은 정의**여야 한다 — 문서에서 바로 읽는 것(라이브 순위 · 제목/개요 길이 · 분류 · 유형 · 실내)은 여기서,
 * 색인에 다시 물어야 하는 것은 [AttractionLtrFeaturePort] 가 만든다. 피처 이름은 모델 파일이 정하고, 모르는 이름이 있으면
 * 기동 시점에 실패한다.
 */
@Component
class AttractionLtrReranker(
    private val properties: AttractionLtrProperties,
    private val featurePort: AttractionLtrFeaturePort,
    objectMapper: ObjectMapper,
    meterRegistry: MeterRegistry,
) {
    private val log = KotlinLogging.logger {}

    private val model: LtrTreeModel? = if (properties.enabled) {
        LtrTreeModel.parse(ClassPathResource(properties.model).inputStream.use { it.readAllBytes().decodeToString() }, objectMapper)
            .also { m -> m.featureNames.forEach { check(isKnown(it)) { "모델 피처 '$it' 를 만들 줄 모른다" } } }
    } else {
        null
    }

    private val appliedCounter = meterRegistry.counter("search.attraction.ltr.applied")
    private val failedCounter = meterRegistry.counter("search.attraction.ltr.failed")

    val depth: Int get() = properties.depth

    fun appliesTo(lang: String?): Boolean = model != null && lang != null && lang in properties.langs

    /**
     * [hits] 는 라이브 순서 그대로 받는다(첫 장의 앞부분). 색인 호출이 실패하면 받은 순서를 그대로 돌려준다 —
     * 이 요청 하나의 순서만 재정렬 전으로 남고, 실패는 `search.attraction.ltr.failed` 로 센다.
     */
    fun rerank(keyword: String, lang: String, vector: List<Float>, hits: List<AttractionHit>): List<AttractionHit> {
        val model = model ?: return hits
        if (hits.size < 2) return hits
        val retrieval = runCatching { featurePort.features(keyword, lang, vector, hits.map { it.document.id }) }
            .onFailure { e ->
                failedCounter.increment()
                log.warn(e) { "LTR 피처를 받지 못해 하이브리드 순서를 그대로 쓴다 keyword=$keyword" }
            }
            .getOrNull() ?: return hits
        val scores = hits.mapIndexed { rank, hit ->
            val x = vectorOf(model.featureNames, rank, keyword, lang, hit.document, retrieval[hit.document.id] ?: LtrRetrievalFeatures())
            model.score(x)
        }
        appliedCounter.increment()
        // 동점은 라이브 순서를 지킨다 — 학습 스크립트의 argsort(kind="stable") 와 같다
        return hits.indices.sortedWith(compareByDescending<Int> { scores[it] }.thenBy { it }).map { hits[it] }
    }

    companion object {
        private val NUMERIC = setOf(
            "c_rank", "a_rank", "b_rank", "bm_title", "bm_overview", "bm_address", "bm_all", "phrase_title", "knn",
            "title_len", "overview_len", "title_has_query",
        )
        private const val CATEGORY = "cat="
        private const val TYPE = "type="
        private const val INDOOR = "setting=indoor"
        private const val ENGLISH = "lang=en"

        private fun isKnown(name: String) =
            name in NUMERIC || name.startsWith(CATEGORY) || name.startsWith(TYPE) || name == INDOOR || name == ENGLISH

        /** 학습 행 한 줄과 같은 정의 — `features.sh` 의 열을 그대로 옮겼다. 길이는 코드 포인트 수(파이썬 `len`)다 */
        internal fun vectorOf(
            names: List<String>,
            liveRank: Int,
            keyword: String,
            lang: String,
            doc: AttractionDocument,
            r: LtrRetrievalFeatures,
        ): DoubleArray = DoubleArray(names.size) { i ->
            val name = names[i]
            when {
                name.startsWith(CATEGORY) -> flag(doc.category.orEmpty() == name.removePrefix(CATEGORY))
                name.startsWith(TYPE) -> flag(doc.contentTypeId.orEmpty() == name.removePrefix(TYPE))
                name == INDOOR -> flag(doc.setting == "indoor")
                name == ENGLISH -> flag(lang == "en")
                else -> when (name) {
                    "c_rank" -> liveRank.toDouble()
                    "a_rank" -> r.aRank.toDouble()
                    "b_rank" -> r.bRank.toDouble()
                    "bm_title" -> r.bmTitle
                    "bm_overview" -> r.bmOverview
                    "bm_address" -> r.bmAddress
                    "bm_all" -> r.bmAll
                    "phrase_title" -> r.phraseTitle
                    "knn" -> r.knn
                    "title_len" -> doc.title.codePointCount(0, doc.title.length).toDouble()
                    "overview_len" -> doc.overview.orEmpty().let { it.codePointCount(0, it.length) }.toDouble()
                    "title_has_query" -> flag(compact(doc.title).contains(compact(keyword)))
                    else -> error("모르는 피처 $name")
                }
            }
        }

        private fun compact(s: String) = s.replace(" ", "").lowercase(Locale.ROOT)

        private fun flag(b: Boolean) = if (b) 1.0 else 0.0
    }
}
