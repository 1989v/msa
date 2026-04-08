package com.kgd.common.analytics

import java.time.Instant

data class AnalyticsEvent(
    val eventId: String,
    val eventType: EventType,
    val userId: Long?,
    val visitorId: String,
    val sessionId: String,
    val timestamp: Instant,
    val experimentAssignments: Map<Long, String>?,
    val payload: Map<String, Any>
)
