package com.kgd.place.application.attraction.usecase

import com.kgd.place.domain.attraction.model.AttractionAccess
import java.time.LocalDateTime

/**
 * 관광지 가는 법(가까운 역·정류장) 적재 — place-ingest `--job=transit-stops` 가 원천 적재 직후 부른다.
 * 계산 회차([computedAt]) 단위로 바뀐다: 보낸 관광지는 행을 통째로 바꾸고(빈 목록이면 지운다), 회차 끝의 [prune] 이
 * 그보다 앞선 행 — 이번 회차에 실리지 않은 관광지(비활성·삭제 포함) — 을 지운다.
 */
interface SyncAttractionAccessUseCase {
    fun replace(computedAt: LocalDateTime, items: List<Item>): Applied

    /** [computedAt] 보다 앞선 계산 회차의 행을 지운다. 반환은 지운 행 수. */
    fun prune(computedAt: LocalDateTime): Int

    data class Item(val attractionId: Long, val stops: List<AttractionAccess>)

    data class Applied(val attractions: Int, val rows: Int, val removed: Int)
}
