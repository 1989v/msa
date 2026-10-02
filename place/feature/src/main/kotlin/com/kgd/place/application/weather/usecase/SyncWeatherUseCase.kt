package com.kgd.place.application.weather.usecase

/** 날씨 적재 — 수집기(place-ingest `weather`)가 단위 매핑과 원천 발표본을 그대로 보낸다. */
interface SyncWeatherUseCase {
    fun applyAreas(midRegions: List<MidRegionItem>, areas: List<AreaItem>): AreasApplied

    fun applyShort(items: List<ShortItem>): Applied

    fun applyMid(items: List<MidItem>): Applied

    data class MidRegionItem(val regId: String, val kind: String, val name: String)

    data class AreaItem(
        val sigunguCode: String,
        val nx: Int,
        val ny: Int,
        val landRegId: String?,
        val taRegId: String?,
        val taMatch: String?,
    )

    /** [baseDate]·[baseTime] 은 원천 표기(`yyyyMMdd` · `HHmm`), [itemsRaw] 는 원천 item 배열 JSON 원문. */
    data class ShortItem(val nx: Int, val ny: Int, val baseDate: String, val baseTime: String, val itemsRaw: String)

    /** [tmFc] 는 원천 표기(`yyyyMMddHHmm`), [itemRaw] 는 원천 항목 JSON 원문. */
    data class MidItem(val regId: String, val kind: String, val tmFc: String, val itemRaw: String)

    data class AreasApplied(val areas: Int, val midRegions: Int)

    /** [sigungu] 는 캐시를 다시 채운 시군구 수. */
    data class Applied(val applied: Int, val sigungu: Int)
}
