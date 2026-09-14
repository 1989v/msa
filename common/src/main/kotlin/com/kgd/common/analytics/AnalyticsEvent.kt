package com.kgd.common.analytics

import java.time.Instant

/**
 * 이벤트 원장의 한 행 (ADR-0095).
 *
 * 대상([entityType]+[entityId])과 동작([action])이 따로 서고, 위치는 [placement] 가 계층으로
 * 들고 있다. 대상별 부가 정보는 [payload] 가 흡수한다 — 정규 필드로 펴면 대상이 늘 때마다
 * nullable 이 는다.
 */
data class AnalyticsEvent(
    val eventId: String,
    val entityType: EntityType,
    /** 체계가 대상마다 달라 문자열로 둔다 (wishlist targetKey 와 같은 선택). */
    val entityId: String,
    val action: EventAction,
    val placement: Placement? = null,
    /**
     * 같은 화면 한 벌. 노출↔클릭을 잇고, 같은 (viewId, entityId) 는 **1회로 센다** —
     * 스크롤로 오갔다고 노출이 늘면 CTR 이 분모부터 틀린다.
     */
    val viewId: String = "",
    val userId: Long?,
    val visitorId: String,
    val sessionId: String,
    val timestamp: Instant,
    val experimentAssignments: Map<Long, String>?,
    val payload: Map<String, Any>,
)
