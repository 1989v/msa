package com.kgd.search.domain.bandit.model

import java.time.Instant

data class ImpressionEvent(
    val searchId: String,
    val key: BanditKey,
    val position: Int,
    val userId: String?,
    val anonymousId: String? = null,
    val occurredAt: Instant = Instant.now()
)

data class ClickEvent(
    val searchId: String,
    val key: BanditKey,
    val position: Int,
    val userId: String?,
    val anonymousId: String? = null,
    val occurredAt: Instant = Instant.now()
)
