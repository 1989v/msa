package com.kgd.place.domain.attraction.model

/**
 * 원천 관광지 이름 + 시군구로 우리 관광지에 이은 방법 — place-ingest `name_match.py` 의 결과. 앞의 셋만 관광지 id 를 갖는다.
 *
 * contentId 를 주지 않는 원천(관광공사 빅데이터 집중률 · 연관 관광지)이 같이 쓴다. 어떤 방법을 화면에 쓸지([SERVED])도
 * 한 곳에 둔다 — 포함 매칭의 정밀도가 확인되면 두 절이 함께 열려야 하므로 원천마다 기준을 따로 갖지 않는다.
 */
enum class NameMatch(val linked: Boolean) {
    EXACT(true),
    NORMALIZED(true),
    CONTAINS(true),
    AMBIGUOUS(false),
    NONE(false),
    ;

    companion object {
        /**
         * 화면(색인)에 쓰는 방법 — 정확 · 정규화. 포함은 정밀도를 표본으로 확인한 뒤 연다(Q-P2-MATCH):
         * 2026-10-02 집중률 실측 21쌍 중 「동거문오름」→「거문오름」처럼 다른 곳에 붙은 것이 있었다.
         */
        val SERVED: Set<NameMatch> = setOf(EXACT, NORMALIZED)

        /**
         * 연관 관광지 **출발**에 쓰는 방법 — [SERVED] + 포함. 2026-10-06 손 확인 두 표본에서 연관 출발 포함 매칭은 49/50 이 맞았다
         * (틀린 1건은 「장경리해변」→「장경리해변야영장」, 우리 행이 야영장 — [AttractionRelated.containsStartAllowed] 로 뺀다).
         * 집중률 포함 매칭은 20/25 · 22/25 라 열지 않는다(「동거문오름」→「거문오름」 · 「운문사」→「운문사계절 캠핑장」).
         * 연관 **대상**의 포함 매칭은 표본이 없어 그대로 [SERVED] 만 쓴다.
         */
        val RELATED_START: Set<NameMatch> = SERVED + CONTAINS
    }
}
