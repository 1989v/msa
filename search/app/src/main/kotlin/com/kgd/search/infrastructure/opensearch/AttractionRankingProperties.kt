package com.kgd.search.infrastructure.opensearch

import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * 관광지 검색의 분류 가중치 (ADR-0065 P2 / ADR-0070 후속).
 *
 * 적재된 59,570건 중 **음식·쇼핑이 62%**(23,310 + 13,807)라 관광 의도의 질의에서도 상점·식당이
 * 관광지를 밀어낸다. 2026-08-19 운영 실측: "경복" 자동완성 1위가 `한복남 경복궁점`,
 * "한옥" 검색 상위 4개가 전부 식당이었다.
 *
 * 상점·식당을 **지우지 않고 내린다** — 근처 검색에서는 여전히 유효한 결과이고, 이 서비스가
 * 보여주려는 것이 관광지일 뿐이다.
 */
@ConfigurationProperties(prefix = "search.attraction-ranking")
data class AttractionRankingProperties(
    /** 관광 분류 가중치. 1.0 이면 무효과 — 끄고 싶으면 1.0 으로 둔다. */
    val sightWeight: Double = 3.0,
    /** 상점·식당 가중치. 0 으로 두지 않는다 — 0 은 제외이고, 우리가 하려는 건 하향이다. */
    val commerceWeight: Double = 0.35,
    val sightCategories: List<String> = listOf("nature", "history", "culture", "leisure"),
    val commerceCategories: List<String> = listOf("shopping", "food"),
    /**
     * 벡터 레그에도 분류 가중치를 건다(단독·하이브리드 둘 다). 동반 표현만 있는 질의는 잔여 검색어가 없어 벡터 레그 단독이고,
     * 거기 가중치가 없으면 상점·식당이 상위를 채웠다(2026-10-13 「family friendly for kids place」 상위 10 중 상점 6).
     * 완결성(popularityScore)은 벡터 레그에 걸지 않는다 — 의미 순위를 완결성이 뒤집는다. 끄면 벡터 레그는 이전과 같은 knn 이다.
     */
    val vectorLeg: Boolean = true,
    /**
     * 소개문 고유도(`contentUniqueness`)를 두 레그에 곱한다 — 같은 브랜드 문구를 나눠 쓰는 지점들이 목록을 채우지 않게 한다.
     * 상업 의도 질의에도 건다. 끄면 이 함수를 넣지 않는다.
     */
    val contentUniqueness: Boolean = true,
    /** 질의의 동행에 맞는 문서(`companions`)에 두 레그가 곱하는 값. 1.0 이면 함수를 넣지 않는다 — 거르지 않고 올리기만 한다. */
    val companionWeight: Double = 1.5,
) {
    /** 두 가중치가 모두 중립이면 function_score 를 감싸지 않는다 (쿼리 단순화). */
    val enabled: Boolean
        get() = sightWeight != 1.0 || commerceWeight != 1.0
}
