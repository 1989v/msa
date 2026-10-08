package com.kgd.search.domain.attraction.model

import java.text.Normalizer
import java.util.Locale

/**
 * 언어 대체 짝 판정 결과. [pairs] 는 id → 상대 언어 문서 id(양방향, 짝이 아닌 문서는 키가 없다).
 * [edges] 는 조건을 모두 만족한 국·영 후보 쌍 수, [droppedByUniqueness] 는 그중 한쪽이 둘 이상과 이어져 뺀 쌍,
 * [droppedByOverview] 는 일대일이지만 한쪽에 개요가 없어 뺀 쌍이다.
 */
data class AlternatePairs(
    val pairs: Map<String, String>,
    val edges: Int,
    val droppedByUniqueness: Int,
    val droppedByOverview: Int,
) {
    val pairCount: Int get() = pairs.size / 2
}

/**
 * 국문 문서와 영문 문서가 서로의 다른 언어판인지 판정한다 — hreflang 으로 이을 짝.
 * 원천은 국문·영문을 contentId 가 다른 별개 행으로 올리고, 같은 placeId 라도 범위가 다른 곳(휴양림 ↔ 그 안의 야영장)이
 * 섞여 있다. 그래서 아래를 **모두** 만족하는 쌍만 후보로 보고, 그중 양쪽 모두 후보가 하나뿐인 것만 짝으로 둔다.
 *
 * 1. 구글 place_id 가 둘 다 있고 같다
 * 2. 거리 [MAX_METERS] 이하
 * 3. [ContentTypeLang] 의 유형이 같다(행사·코스는 빠진다)
 * 4. 영문 문서의 로컬명(`titleLocal`)과 국문 표시명(`title`)이 [normalizeTitle] 뒤 같다
 *
 * 짝 중 한쪽이라도 개요가 없으면 뺀다 — 개요 없는 상세는 noindex 라 hreflang 상대가 될 수 없다.
 * 같은 언어 안의 중복 등록([SamePlaceGrouper])과는 다른 개념이고 서로 섞지 않는다.
 */
object AlternateLanguagePairer {

    const val MAX_METERS = 50

    private val SPACES = Regex("[\\s\\p{Z}]+")

    fun pair(projections: List<RegionProjection>): AlternatePairs {
        val edges = projections
            .filter { !it.googlePlaceId.isNullOrBlank() && ContentTypeLang.of(it.lang, it.contentTypeId)?.pairable == true }
            .groupBy { it.googlePlaceId!! }
            .values
            .flatMap { samePlaceId ->
                val koDocs = samePlaceId.filter { it.lang == "ko" }
                val enDocs = samePlaceId.filter { it.lang == "en" && !it.titleLocal.isNullOrBlank() }
                koDocs.flatMap { k -> enDocs.filter { e -> isCandidate(k, e) }.map { e -> k to e } }
            }

        val koDegree = edges.groupingBy { it.first.id }.eachCount()
        val enDegree = edges.groupingBy { it.second.id }.eachCount()
        val unique = edges.filter { (k, e) -> koDegree[k.id] == 1 && enDegree[e.id] == 1 }
        val shown = unique.filter { (k, e) -> k.hasOverview && e.hasOverview }

        val pairs = HashMap<String, String>(shown.size * 4)
        shown.forEach { (k, e) ->
            pairs[k.id] = e.id
            pairs[e.id] = k.id
        }
        return AlternatePairs(
            pairs = pairs,
            edges = edges.size,
            droppedByUniqueness = edges.size - unique.size,
            droppedByOverview = unique.size - shown.size,
        )
    }

    private fun isCandidate(k: RegionProjection, e: RegionProjection): Boolean =
        ContentTypeLang.of(k.lang, k.contentTypeId) == ContentTypeLang.of(e.lang, e.contentTypeId) &&
            RegionAggregator.distanceMeters(k, e) <= MAX_METERS &&
            normalizeTitle(e.titleLocal!!) == normalizeTitle(k.title)

    /** NFKC → 모든 공백(유니코드 공백 포함) 제거 → 소문자. 전각 숫자·NBSP·줄 바꿈·대소문자만 다른 제목을 같게 본다. */
    internal fun normalizeTitle(title: String): String =
        Normalizer.normalize(title, Normalizer.Form.NFKC).replace(SPACES, "").lowercase(Locale.ROOT)
}
