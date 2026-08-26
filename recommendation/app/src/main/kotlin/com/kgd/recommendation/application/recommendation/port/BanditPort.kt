package com.kgd.recommendation.application.recommendation.port

/** funnel variant 를 밴딧이 고를 때 (Phase 6). 비활성이면 null */
interface BanditPort {
    fun selectIfEnabled(): String?
    fun recordImpression(variant: String)
}
