package com.kgd.search.domain.attraction.model

/**
 * 「여기 온 사람들이 함께 간 곳」 한 건 — 한국관광공사 빅데이터 `TarRlteTarService1`(내비게이션 이동 기반, 월 단위)의 연관 관광지.
 *
 * 원천에 contentId 가 없어 place 가 이름 + 시군구로 이은 곳만 온다 — 출발·대상 모두 정확 · 정규화 매칭, 대상은 우리 관광지 행(상세 페이지가 있는 것)으로 이어진 것만 — 원천 분류가 음식·숙박이어도 우리 음식점·숙박 행이면 온다.
 * [rank] 는 원천 순위 그대로, [title] 은 그 관광지의 지금 표시명(재색인 시점), [category] 는 원천 소분류 이름이다.
 * 같은 언어 활성 문서로 이어진 것만 순위 순으로 최대 [MAX] 건 — 「비슷한 곳」(임베딩)과 겹쳐도 각 절이 따로 그린다.
 */
data class RelatedPlace(val rank: Int, val id: String, val title: String, val sidoName: String?, val category: String?) {
    companion object {
        /** 상세에 그리는 최대 수(설계 §7). */
        const val MAX = 6
    }
}
