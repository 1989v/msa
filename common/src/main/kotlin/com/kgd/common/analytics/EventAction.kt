package com.kgd.common.analytics

/**
 * 이벤트의 **동작** (ADR-0095). 대상([EntityType])과 곱해 쓰지 않고 따로 둔다.
 *
 * `IMPRESSION` 은 **사용자에게 실제로 보인 것**이다 — 그려진 것이 아니다. 화면 밖에 있거나
 * 스쳐 지나간 것을 세면 CTR 이 분모부터 틀린다. 판정 기준은 FE 가 지킨다.
 */
enum class EventAction {
    IMPRESSION,
    CLICK,
    SEARCH,
    ADD_TO_CART,
    ORDER_COMPLETE,
    SESSION_START,
    SESSION_END,
}
