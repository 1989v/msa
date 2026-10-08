package com.kgd.place.application.attraction.usecase

import java.time.LocalDateTime

/**
 * 본문이 실제로 바뀐 관광지 목록 — IndexNow 제출 잡(place-ingest)이 바뀐 상세 주소를 고를 때 쓴다.
 * 운영 중인 관광지만, `since ≤ 본문 변경 시각 < until`(서울 시각), id 키셋으로 이어 읽는다.
 */
interface FindContentUpdatedAttractionsUseCase {
    fun find(query: Query): Result

    data class Query(val since: LocalDateTime, val until: LocalDateTime, val afterId: Long, val size: Int)

    data class Item(val id: Long, val lang: String)

    /** [nextAfterId] 는 다음 쪽을 읽을 기준 id — 마지막 쪽이면 null. */
    data class Result(val items: List<Item>, val nextAfterId: Long?)
}
