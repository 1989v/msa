package com.kgd.ads.domain.token.model

/** 이벤트·클릭을 과금하지 않은 이유. [code] 가 응답·메트릭에 나가는 값이다. */
enum class EventRejectReason {
    INVALID_SIGNATURE,
    EXPIRED,
    DUPLICATE,
    VISITOR_MISMATCH,
    CRAWLER,
    NOT_BILLABLE,
    RATE_LIMITED,
    OVER_BUDGET,
    REDIS_UNAVAILABLE,
    ;

    val code: String get() = name.lowercase()
}
