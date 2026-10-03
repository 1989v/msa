package com.kgd.search.domain.attraction.model

/**
 * 같은 장소의 다른 등록 — 원천(TourAPI)이 한 장소를 관광지·쇼핑 등으로 따로 올리거나 같은 유형으로 두 번 올린 곳.
 * 상세는 이 장소를 「복합공간」으로 알리고 다른 등록으로 잇는다. 제목은 자기와 같으므로 싣지 않는다.
 */
data class SamePlace(val id: String, val contentTypeId: String?)

/**
 * 같은 언어 · 같은 법정동 시군구 · 같은 **원천 제목**이면서 [MAX_METERS] 안에 있는 다른 활성 문서끼리 묶는다.
 * 표시명(괄호를 뗀 제목)으로 묶지 않는다 — 운영에서 괄호로만 갈리는 별개 매장·시설 29쌍이 같은 장소로 묶였다
 * (디올 남성 · 여성 매장, ABC마트 GS · KM 매장, 돌배야영장 제1 · 제2 야영장).
 * 제목만 같은 다른 곳(같은 구의 동명 공원 등)은 거리로 거른다. 결과는 id → 자기를 뺀 다른 등록(id 순).
 */
object SamePlaceGrouper {
    /**
     * 같은 장소로 보는 거리. 운영 전체(2026-10-03, 활성 64,967)에서 같은 언어·시군구·제목 쌍은 72개 —
     * 50m 안 54 · 1km 안 67(한국민속촌 관광지·쇼핑 754m 까지)이고, 그 밖은 동명의 다른 곳이다(영진항 2.6km · 횟집 18km).
     */
    const val MAX_METERS = 1_000

    fun group(projections: List<RegionProjection>): Map<String, List<SamePlace>> {
        val out = HashMap<String, List<SamePlace>>()
        projections
            .filter { it.ldongRegnCd != null && it.ldongSignguCd != null && (it.sourceTitle ?: it.title).isNotBlank() }
            .groupBy { listOf(it.lang, it.ldongRegnCd, it.ldongSignguCd, it.sourceTitle ?: it.title) }
            .values
            .filter { it.size > 1 }
            .forEach { same ->
                same.forEach { self ->
                    val others = same
                        .filter { it.id != self.id && RegionAggregator.distanceMeters(self, it) <= MAX_METERS }
                        .sortedBy { it.id.toLongOrNull() ?: Long.MAX_VALUE }
                        .map { SamePlace(it.id, it.contentTypeId) }
                    if (others.isNotEmpty()) out[self.id] = others
                }
            }
        return out
    }
}
