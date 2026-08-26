package com.kgd.deal.application.offer.port

import com.kgd.deal.domain.model.DailyClicks
import com.kgd.deal.domain.model.OfferClick
import java.time.LocalDateTime

interface DealOfferClickRepositoryPort {
    fun save(click: OfferClick)
    /** `[from, to)` 구간의 일별 집계, 날짜 오름차순 */
    fun countDailyByOffer(offerId: Long, from: LocalDateTime, to: LocalDateTime): List<DailyClicks>
}
