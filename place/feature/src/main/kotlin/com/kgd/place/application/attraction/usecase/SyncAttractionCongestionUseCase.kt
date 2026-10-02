package com.kgd.place.application.attraction.usecase

import java.time.LocalDate

/**
 * 관광지 집중률 적재 — place-ingest `--job=congestion` 이 시군구마다 부른다. 매칭은 수집기가 끝내고 오고,
 * 서버는 앞뒤만 검사해 그 시군구의 행을 통째로 바꾼다(새 예측이 옛 예측을 대체). 보내지 않은 시군구는 그대로다.
 */
interface SyncAttractionCongestionUseCase {
    fun replaceSigungu(signguCd: String, items: List<Item>): Applied

    /** [ratesRaw] 는 원천 행 배열 원문, [matchMethod] 는 `EXACT|NORMALIZED|CONTAINS|AMBIGUOUS|NONE`. */
    data class Item(
        val tAtsNm: String,
        val areaCd: String,
        val areaNm: String?,
        val signguNm: String?,
        val ratesRaw: String,
        val firstYmd: LocalDate,
        val lastYmd: LocalDate,
        val attractionId: Long?,
        val matchMethod: String,
    )

    /** [linked] 는 관광지 id 가 붙은 행 수(화면에 쓰지 않는 포함 매칭도 센다), [removed] 는 지운 이전 행 수. */
    data class Applied(val applied: Int, val linked: Int, val removed: Int)
}
