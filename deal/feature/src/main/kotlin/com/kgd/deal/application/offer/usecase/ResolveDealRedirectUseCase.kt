package com.kgd.deal.application.offer.usecase

import java.time.LocalDateTime

/** `/go/{slug}` 해석 (ADR-0069 §3) */
interface ResolveDealRedirectUseCase {
    fun execute(slug: String, now: LocalDateTime = LocalDateTime.now()): Decision

    sealed interface Decision {
        /** 정상 — [targetUrl] 을 **원본 그대로** 302 로 넘긴다 */
        data class Go(val offerId: Long, val targetUrl: String) : Decision

        /** 만료·비전시 — 404 대신 카테고리 목록으로 보낸다. 프로모션은 끝나도 공유된 링크는 남는다 */
        data class Unavailable(val categoryCode: String) : Decision

        data object NotFound : Decision
    }
}
