package com.kgd.ads.application.event.usecase

import com.kgd.ads.domain.token.model.EventRejectReason

/**
 * 화면이 모아 보낸 가시 노출 토큰을 토큰마다 따로 판정해 수락한 것만 카운터에 올린다.
 * 지면별 최종 채움 출처도 함께 받아 참고 통계로 센다.
 */
interface AcceptAdEventsUseCase {
    fun execute(command: Command): Result

    /**
     * @param visitorId 게이트웨이가 넣은 `X-Visitor-Id`(vid 쿠키). 토큰의 방문자 해시와 맞아야 과금한다
     * @param analyticsVisitorId 화면 `identity.ts` 의 방문자 id — analytics 사본용이지 과금 근거가 아니다
     * @param analyticsSessionId 화면 `identity.ts` 의 세션 id — 위와 같다
     */
    data class Command(
        val impressionTokens: List<String>,
        val visitorId: String?,
        val analyticsVisitorId: String?,
        val analyticsSessionId: String?,
        val fills: List<FillReport>,
        val userAgent: String?,
    )

    /** [source] 는 요청 문자열 그대로 — 허용 값이 아니면 세지 않는다. */
    data class FillReport(val placementKey: String, val source: String)

    data class Result(val accepted: Int, val rejected: Map<EventRejectReason, Int>)
}
