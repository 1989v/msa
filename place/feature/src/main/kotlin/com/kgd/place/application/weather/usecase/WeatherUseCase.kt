package com.kgd.place.application.weather.usecase

import java.time.LocalDateTime

/**
 * 시군구 날씨 「오늘 ~ 10일」 — 관광지 상세의 「○○구 날씨」 절이 부른다. 화면이 부르는 경로라 레디스 캐시에서 나간다.
 * [now] 는 KST 벽시계 — 신선도(단기 발표 24시간 · 중기 30시간)와 지난 날짜를 이 시각으로 거른다.
 */
interface WeatherUseCase {
    fun outlook(sigunguCode: String, now: LocalDateTime): Outlook

    /**
     * 캐시 값의 모양이라 문자열·수로만 둔다(날짜 타입 직렬화 설정에 기대지 않는다).
     * [shortBaseAt]·[midTmFc] 는 원천 발표 시각(`yyyy-MM-ddTHH:mm`, KST) — 화면의 출처 문구에 함께 낸다. [days] 가 비면 화면은 절을 그리지 않는다.
     */
    data class Outlook(val sigunguCode: String, val shortBaseAt: String?, val midTmFc: String?, val days: List<Day>)

    /** [source] 는 SHORT(단기) · MID(중기). 단기·중기 4~7일은 [am]/[pm], 중기 8~10일은 [allDay] 하나. 원천에 없는 칸은 null. */
    data class Day(
        val date: String,
        val source: String,
        val min: Int?,
        val max: Int?,
        val am: Half?,
        val pm: Half?,
        val allDay: Half?,
    )

    /** [sky] 는 기상청 중기예보 표현(맑음 · 구름많음 · 흐리고 비 …), [pop] 은 강수확률(%). */
    data class Half(val sky: String, val pop: Int?)
}
