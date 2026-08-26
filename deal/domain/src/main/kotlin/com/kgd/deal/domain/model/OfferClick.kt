package com.kgd.deal.domain.model

import java.time.LocalDate
import java.time.LocalDateTime

/**
 * 아웃바운드 클릭 1건 (ADR-0069).
 *
 * IP · 전체 referrer · 쿠키는 담지 않는다 — 클릭 수를 세는 데 필요 없고, 보관하는 순간
 * 개인정보 처리방침 대상이 된다. referrer 는 **호스트만**.
 */
data class OfferClick(
    val offerId: Long,
    val clickedAt: LocalDateTime,
    val referrerHost: String?,
    val uaFamily: String?,
)

/** 하루치 클릭 수 — 어드민 추이 그래프 한 점 */
data class DailyClicks(
    val date: LocalDate,
    val count: Long,
)
