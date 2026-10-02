package com.kgd.place.application.attraction.usecase

/**
 * 연관 관광지 적재 — place-ingest `--job=related` 가 시군구마다 부른다. 매칭은 수집기가 끝내고 오고,
 * 서버는 앞뒤만 검사해 그 시군구의 행을 [baseYm] 달로 통째로 바꾼다(새 달이 옛 달을 대체). 보내지 않은 시군구는 그대로다.
 */
interface SyncAttractionRelatedUseCase {
    fun replaceSigungu(signguCd: String, baseYm: String, items: List<Item>): Applied

    /** 시군구별 가진 최신 기준 월 — 수집기가 이미 받은 달을 다시 부르지 않으려고 읽는다. */
    fun state(): Map<String, String>

    /** [relatedRaw] 는 원천 행 배열 원문, [matchMethod] 는 `EXACT|NORMALIZED|CONTAINS|AMBIGUOUS|NONE`. */
    data class Item(
        val tAtsCd: String,
        val tAtsNm: String,
        val relatedRaw: String,
        val attractionId: Long?,
        val matchMethod: String,
        val targets: List<Target>,
    )

    /** 대상 한 건 — 원천 순위·이름·분류 3단·대상 시군구와 그 매칭. */
    data class Target(
        val rank: Int,
        val name: String,
        val lcls: String?,
        val mcls: String?,
        val scls: String?,
        val signguCd: String?,
        val attractionId: Long?,
        val matchMethod: String,
    )

    /** [linked] 는 출발이 관광지에 이어진 행 수(화면에 쓰지 않는 포함 매칭도 센다), [removed] 는 지운 이전 행 수. */
    data class Applied(val applied: Int, val linked: Int, val removed: Int)
}
