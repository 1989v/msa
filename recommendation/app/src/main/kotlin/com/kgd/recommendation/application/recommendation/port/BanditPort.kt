package com.kgd.recommendation.application.recommendation.port

/** funnel variant 를 밴딧이 고를 때 (Phase 6). 비활성이면 null */
interface BanditPort {
    fun selectIfEnabled(): String?
    fun recordImpression(variant: String)

    /** 운영자 모니터링·수동 보정 (내부 전용 엔드포인트). 비활성이면 아무 일도 하지 않는다. */
    fun snapshot(): List<BanditVariantStats>
    fun recordClick(variant: String)
    fun reset()
}

data class BanditVariantStats(
    val variant: String,
    val successes: Long,
    val failures: Long,
    val expectedCtr: Double,
)
