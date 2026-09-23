package com.kgd.ads.presentation.decision.controller

import com.kgd.ads.application.decision.usecase.DecideAdsUseCase
import com.kgd.ads.presentation.decision.dto.DecisionRequest
import com.kgd.ads.presentation.decision.dto.DecisionResponse
import com.kgd.common.response.ApiResponse
import jakarta.validation.Valid
import org.springframework.http.HttpHeaders
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * 광고 결정. 신원은 게이트웨이가 넣는 헤더만 믿는다 — `X-Visitor-Id`(vid 쿠키) · `X-User-Id`(게스트 허용 필터가
 * 클라이언트 값을 지우고 토큰에서 넣는다). Redis 가 죽어도 200 으로 「유료 광고 없음」을 준다.
 */
@RestController
@RequestMapping("/api/v1/ads")
class AdDecisionController(
    private val decideAds: DecideAdsUseCase,
) {
    @PostMapping("/decisions")
    fun decide(
        @Valid @RequestBody request: DecisionRequest,
        @RequestHeader(VISITOR_HEADER, required = false) visitorId: String?,
        @RequestHeader(USER_HEADER, required = false) userId: String?,
        @RequestHeader(HttpHeaders.USER_AGENT, required = false) userAgent: String?,
    ): ApiResponse<DecisionResponse> {
        val result = decideAds.execute(
            DecideAdsUseCase.Command(
                placementKeys = request.placements,
                host = request.host,
                contextKey = request.contextKey,
                visitorId = visitorId,
                memberId = userId?.toLongOrNull(),
                userAgent = userAgent,
            ),
        )
        return ApiResponse.success(DecisionResponse.from(result))
    }

    companion object {
        const val VISITOR_HEADER = "X-Visitor-Id"
        const val USER_HEADER = "X-User-Id"
    }
}
