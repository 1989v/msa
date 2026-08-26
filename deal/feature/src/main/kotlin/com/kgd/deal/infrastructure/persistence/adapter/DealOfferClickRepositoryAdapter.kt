package com.kgd.deal.infrastructure.persistence.adapter

import com.kgd.deal.application.offer.port.DealOfferClickRepositoryPort
import com.kgd.deal.domain.model.DailyClicks
import com.kgd.deal.domain.model.OfferClick
import com.kgd.deal.infrastructure.persistence.entity.DealOfferClickJpaEntity
import com.kgd.deal.infrastructure.persistence.repository.DealOfferClickJpaRepository
import org.springframework.stereotype.Component
import java.sql.Date as SqlDate
import java.time.LocalDate
import java.time.LocalDateTime

@Component
class DealOfferClickRepositoryAdapter(
    private val jpaRepository: DealOfferClickJpaRepository,
) : DealOfferClickRepositoryPort {

    override fun save(click: OfferClick) {
        jpaRepository.save(DealOfferClickJpaEntity.fromDomain(click))
    }

    /** 집계 행은 `[DATE, COUNT]` 배열로 온다 — 드라이버마다 날짜 타입이 달라 여기서 흡수한다 */
    override fun countDailyByOffer(offerId: Long, from: LocalDateTime, to: LocalDateTime): List<DailyClicks> =
        jpaRepository.countDailyByOffer(offerId, from, to).map { row ->
            DailyClicks(
                date = when (val day = row[0]) {
                    is SqlDate -> day.toLocalDate()
                    is LocalDate -> day
                    else -> LocalDate.parse(day.toString())
                },
                count = (row[1] as Number).toLong(),
            )
        }
}
