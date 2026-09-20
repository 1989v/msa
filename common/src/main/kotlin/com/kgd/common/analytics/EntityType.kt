package com.kgd.common.analytics

/**
 * 이벤트의 **대상** (ADR-0095).
 *
 * 동작([EventAction])과 따로 둔다. 예전에는 `PRODUCT_VIEW`·`PRODUCT_CLICK` 처럼 한 축에 눌러
 * 놨는데, 그러면 대상이 늘 때마다 enum 이 **대상 수 × 동작 수**로 자란다. 질의도 어색해진다 —
 * 「전 서비스 노출」을 세려면 `IN (…)` 목록을 손으로 유지해야 하고, 빠뜨리면 조용히 적게 센다.
 */
enum class EntityType {
    ATTRACTION,
    PRODUCT,
    POST,
    GAME,
    /** 대상이 개별 항목이 아니라 화면 자체일 때 (구 `PAGE_VIEW`). */
    PAGE,
    /** 검색 질의 자체 (구 `SEARCH_KEYWORD`). entityId 는 질의어. */
    SEARCH,

    /** 개념 사전 항목. entityId 는 `conceptId`. */
    CONCEPT,

    /** 혜택 오퍼. entityId 는 slug — 클릭은 `/go/` 리다이렉터도 따로 센다(ADR-0069). */
    DEAL_OFFER,

    /** 전시 서비스 타일. entityId 는 `display_service.code`. */
    SERVICE,
}
