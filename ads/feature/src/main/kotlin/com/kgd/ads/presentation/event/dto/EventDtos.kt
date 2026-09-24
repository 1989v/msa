package com.kgd.ads.presentation.event.dto

import com.kgd.ads.application.event.usecase.AcceptAdEventsUseCase
import jakarta.validation.Valid
import jakarta.validation.constraints.Size

/**
 * 광고 이벤트 묶음 — 가시 노출 토큰 + analytics 신원 + 지면별 최종 채움 출처.
 * 개수 상한은 한 요청이 Redis 스크립트 한 번에 싣는 양을 묶는다.
 *
 * @param visitorId·sessionId 화면 `identity.ts` 의 값. 과금은 이 값이 아니라 게이트웨이의 `X-Visitor-Id` 로 판정한다
 */
data class EventsRequest(
    @field:Size(max = MAX_TOKENS)
    val tokens: List<@Size(max = MAX_TOKEN_LENGTH) String> = emptyList(),
    @field:Size(max = 128)
    val visitorId: String? = null,
    @field:Size(max = 128)
    val sessionId: String? = null,
    @field:Valid
    @field:Size(max = MAX_FILLS)
    val fills: List<FillRequest> = emptyList(),
) {
    fun toCommand(gatewayVisitorId: String?, userAgent: String?) = AcceptAdEventsUseCase.Command(
        impressionTokens = tokens,
        visitorId = gatewayVisitorId,
        analyticsVisitorId = visitorId,
        analyticsSessionId = sessionId,
        fills = fills.map { AcceptAdEventsUseCase.FillReport(it.placementKey, it.source) },
        userAgent = userAgent,
    )

    companion object {
        const val MAX_TOKENS = 50
        const val MAX_FILLS = 20
        const val MAX_TOKEN_LENGTH = 512
    }
}

/** @param source `PAID`·`ADSENSE`·`HOUSE`·`EMPTY` — 그 밖의 값은 400 이 아니라 세지 않고 넘긴다 */
data class FillRequest(
    @field:Size(min = 1, max = 64)
    val placementKey: String,
    @field:Size(min = 1, max = 16)
    val source: String,
)

/** @param rejected 거절 사유 코드 → 개수 */
data class EventsResponse(val accepted: Int, val rejected: Map<String, Int>) {
    companion object {
        fun from(result: AcceptAdEventsUseCase.Result) =
            EventsResponse(result.accepted, result.rejected.mapKeys { it.key.code })
    }
}
