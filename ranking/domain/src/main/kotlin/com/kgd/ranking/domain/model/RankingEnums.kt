package com.kgd.ranking.domain.model

/**
 * 무엇을 줄세우는가 (ADR-0081).
 *
 * 도메인이 늘어도 [RankingEntry] 는 바뀌지 않는다 — 순위를 만드는 규칙만 도메인별로 는다.
 */
enum class RankingDomain {
    /** 주유소 — 오피넷 */
    GAS_STATION,
}

/**
 * 무엇으로 줄세우는가.
 *
 * 지표와 도메인을 분리해 두는 이유는 한 도메인이 여러 축으로 줄세워지기 때문이다 —
 * 같은 주유소 목록이 유종별 가격으로도, 나중에는 접근성이나 선호로도 정렬된다.
 */
enum class RankingMetric {
    /** 유종별 판매가 (원/L) */
    FUEL_PRICE,
}

/**
 * 낮은 값이 1등인가, 높은 값이 1등인가.
 *
 * 최저가는 [ASC], 인기·판매량류는 [DESC]. 이 값을 보드가 들고 있어야 화면이 지표마다
 * 정렬 방향을 알 필요가 없다.
 */
enum class SortDirection {
    ASC,
    DESC,
}

/** 보드 전시 상태 (ADR-0066 커머스 전시 상태 관례와 같은 축). */
enum class BoardStatus {
    OPEN,
    PREOPEN,
    HOLD;

    val displayed: Boolean get() = this != HOLD
}
