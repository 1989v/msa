package com.kgd.ads.application.event.usecase

/**
 * 광고 클릭 — 보낼 곳을 정하고, 과금할 수 있는 클릭이면 센다.
 * 목적지는 토큰이 아니라 DB 의 승인된 소재 랜딩 URL 이다. 서명이 틀렸거나 승인된 소재가 아니면 `/`.
 * 과금 기록이 실패해도 보낼 곳은 항상 돌려준다.
 *
 * [Command.analyticsVisitorId]·[Command.analyticsSessionId] 는 화면 `identity.ts` 값으로, analytics 사본에만 쓴다 — 과금은 보지 않는다.
 */
interface RedirectClickUseCase {
    fun execute(command: Command): String

    data class Command(
        val clickToken: String,
        val visitorId: String?,
        val userAgent: String?,
        val analyticsVisitorId: String? = null,
        val analyticsSessionId: String? = null,
    )
}
