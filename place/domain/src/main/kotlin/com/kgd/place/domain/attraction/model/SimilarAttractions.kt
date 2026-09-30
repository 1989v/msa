package com.kgd.place.domain.attraction.model

/**
 * 한 관광지의 「비슷한 곳」 목록 — 같은 언어·같은 유형·다른 시도에서 코사인 상위 순.
 *
 * 서버는 계산하지 않는다. `tools/embed` 가 문서 벡터로 계산해 보내고, 재색인이 읽어 상세에 싣는다.
 * 목록은 문서·스탬프 단위로 **통째로** 바뀐다 — 순위 하나만 고치는 경로가 없어야 순위가 비거나 겹치지 않는다.
 * [items] 의 순서가 곧 순위다(0 이 가장 비슷하다). 빈 목록은 「후보 없음」이고 옛 목록을 지운다.
 */
class SimilarAttractions private constructor(
    val attractionId: Long,
    val modelRef: EmbeddingModelRef,
    val items: List<Item>,
) {
    data class Item(val similarId: Long, val score: Double)

    companion object {
        const val MAX_ITEMS = 5

        /** 코사인은 -1~1 이다. float32 반올림 여유만 둔다. */
        private const val SCORE_BOUND = 1.0001

        fun create(attractionId: Long, modelRef: EmbeddingModelRef, items: List<Item>): SimilarAttractions {
            require(items.size <= MAX_ITEMS) { "비슷한 곳은 ${MAX_ITEMS}곳까지입니다: $attractionId (${items.size})" }
            require(items.none { it.similarId == attractionId }) { "비슷한 곳에 자기 자신이 있습니다: $attractionId" }
            require(items.map { it.similarId }.toSet().size == items.size) { "비슷한 곳이 겹칩니다: $attractionId" }
            require(items.all { it.score.isFinite() && it.score in -SCORE_BOUND..SCORE_BOUND }) {
                "점수는 -1~1 의 유한값이어야 합니다: $attractionId"
            }
            return SimilarAttractions(attractionId, modelRef, items)
        }
    }
}
