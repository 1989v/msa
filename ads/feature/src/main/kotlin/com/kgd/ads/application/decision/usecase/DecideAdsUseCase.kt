package com.kgd.ads.application.decision.usecase

/**
 * 한 페이지의 지면들에 광고를 정한다. 지면마다 유료 광고 하나 또는 없음(사유) + HOUSE 소재 목록.
 * 결정 경로는 DB 를 읽지 않는다 — 후보는 메모리 인덱스, 실시간 값은 ads Redis 한 번 읽기.
 */
interface DecideAdsUseCase {
    fun execute(command: Command): Result

    /**
     * @param visitorId 게이트웨이가 넣은 `X-Visitor-Id`. 없으면 빈도·토큰을 만들 수 없어 유료 광고를 내지 않는다
     * @param memberId 게이트웨이가 넣은 `X-User-Id`. 낙찰 캠페인의 소유 회원이면 토큰을 과금하지 않는다
     */
    data class Command(
        val placementKeys: List<String>,
        val host: String,
        val contextKey: String?,
        val visitorId: String?,
        val memberId: Long?,
        val userAgent: String?,
    )

    data class Result(val decisionId: String, val placements: List<PlacementDecision>)

    /** [ad] 가 null 이면 [noAdReason] 이 있다. [house] 는 유료 여부와 무관하게 그 지면의 승인된 HOUSE 소재다. */
    data class PlacementDecision(
        val placementKey: String,
        val ad: ServedAdView?,
        val noAdReason: NoAdReason?,
        val house: List<HouseCreativeView>,
    )

    data class ServedAdView(
        val campaignId: Long,
        val creativeId: Long,
        val title: String,
        val body: String,
        val imageHash: String,
        val advertiserName: String,
        val impressionToken: String,
        val clickToken: String,
    )

    data class HouseCreativeView(
        val creativeId: Long,
        val title: String,
        val body: String,
        val emoji: String?,
        val link: String,
        val imageHash: String?,
    )

    enum class NoAdReason {
        NO_CANDIDATES,
        UNREGISTERED_PLACEMENT,
        REDIS_UNAVAILABLE,
        ;

        val code: String get() = name.lowercase()
    }
}
