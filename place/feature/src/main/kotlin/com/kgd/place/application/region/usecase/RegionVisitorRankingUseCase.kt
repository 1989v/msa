package com.kgd.place.application.region.usecase

/**
 * 시도 페이지 「타지 방문자가 많은 시군구」 — 마지막 다 받은 달의 외지인+외국인 합 상위 10. 화면이 부르는 경로라
 * 레디스 캐시에서 나간다.
 */
interface RegionVisitorRankingUseCase {
    /** [sidoCode] 가 지금 있는 2자리 시도 코드가 아니면 INVALID_INPUT(400). */
    fun ranking(sidoCode: String): Ranking

    /**
     * [month] 는 다 받은 달(`yyyy-MM`), 없으면 null 이고 [items] 가 빈다 — 화면은 절을 그리지 않는다.
     * 캐시 값의 모양이라 문자열·수로만 둔다.
     */
    data class Ranking(val month: String?, val items: List<Item>)

    /** 수치는 명 단위, 소수 버림. [total] = 외지인 + 외국인. */
    data class Item(val code: String, val name: String, val nameEn: String?, val outsiders: Long, val foreigners: Long, val total: Long)
}
