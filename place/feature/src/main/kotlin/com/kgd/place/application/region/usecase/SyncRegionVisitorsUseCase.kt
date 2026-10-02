package com.kgd.place.application.region.usecase

/** 지역 방문자 일자 행 적재 — 수집기(place-ingest)가 원천 행을 그대로 보낸다. */
interface SyncRegionVisitorsUseCase {
    fun apply(items: List<Item>): Applied

    /** [baseYmd] 는 원천 표기(`yyyyMMdd`), [touNum] 은 원천 문자열 원문. */
    data class Item(
        val level: String,
        val regionCode: String,
        val baseYmd: String,
        val touDivCd: String,
        val touNum: String,
        val regionName: String?,
        val touDivNm: String?,
        val daywkDivCd: String?,
        val daywkDivNm: String?,
    )

    /** [regions] 는 캐시를 다시 채운 지역 수. */
    data class Applied(val applied: Int, val regions: Int)
}
