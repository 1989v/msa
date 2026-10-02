package com.kgd.place.application.region.usecase

/** 지역 허브 「방문 추이」 — 다 받은 달의 월 합계(최근 12달). 화면이 부르는 경로라 레디스 캐시에서 나간다. */
interface RegionVisitorUseCase {
    fun trend(code: String): Trend

    /**
     * [latestDate] 는 받은 가장 최근 날(`yyyy-MM-dd`), 없으면 null. [months] 가 비면 화면은 절을 그리지 않는다.
     * 캐시 값의 모양이라 문자열·수로만 둔다(날짜 타입 직렬화 설정에 기대지 않는다).
     */
    data class Trend(val code: String, val level: String, val latestDate: String?, val months: List<Month>)

    data class Month(val month: String, val local: Long, val outsider: Long, val foreigner: Long)
}
