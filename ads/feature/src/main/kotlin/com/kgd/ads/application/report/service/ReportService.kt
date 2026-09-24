package com.kgd.ads.application.report.service

import com.kgd.ads.application.advertiser.service.AdvertiserAccess
import com.kgd.ads.application.campaign.port.CampaignPort
import com.kgd.ads.application.report.dto.CreativeHourRow
import com.kgd.ads.application.report.port.ReportPort
import com.kgd.ads.application.report.usecase.GetAdvertiserReportUseCase
import com.kgd.ads.application.report.usecase.GetAdvertiserReportUseCase.CampaignDay
import com.kgd.ads.application.report.usecase.GetAdvertiserReportUseCase.CreativeDay
import com.kgd.ads.application.report.usecase.GetPublisherReportUseCase
import com.kgd.ads.application.report.usecase.GetPublisherReportUseCase.ClientReportedFill
import com.kgd.ads.application.report.usecase.GetPublisherReportUseCase.PlacementDay
import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import org.springframework.stereotype.Service
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.temporal.ChronoUnit

@Service
class ReportService(
    private val access: AdvertiserAccess,
    private val campaignPort: CampaignPort,
    private val reportPort: ReportPort,
) : GetAdvertiserReportUseCase, GetPublisherReportUseCase {

    override fun execute(memberId: Long, from: LocalDate, to: LocalDate): List<CampaignDay> {
        val (start, until) = range(from, to)
        val advertiserId = requireNotNull(access.require(memberId).id)
        val names = campaignPort.findAllByAdvertiser(advertiserId).associate { requireNotNull(it.id) to it.name }
        val settled = reportPort.settlements(advertiserId, start, until).associateBy { it.campaignId to it.hourKst }

        return reportPort.creativeHours(advertiserId, start, until)
            .groupBy { it.campaignId to it.hourKst.toLocalDate() }
            .map { (key, rows) ->
                val (campaignId, date) = key
                val spend = rows.sumOf { it.spendMicros }
                // 그 날 집계가 있는 시각마다 정산 기록이 있어야 청구액이 확정이다.
                val hours = rows.map { it.hourKst }.toSet()
                val charged = if (hours.all { (campaignId to it) in settled }) hours.sumOf { settled.getValue(campaignId to it).chargedMicros } else null
                CampaignDay(
                    campaignId = campaignId,
                    campaignName = names[campaignId].orEmpty(),
                    date = date,
                    impressions = rows.sumOf { it.impressions },
                    clicks = rows.sumOf { it.clicks },
                    ctr = ctr(rows.sumOf { it.clicks }, rows.sumOf { it.impressions }),
                    spendMicros = spend,
                    chargedMicros = charged,
                    unbilledOverBudget = charged != null && charged != spend,
                    creatives = rows.groupBy { it.creativeId }.map { (creativeId, c) -> creativeDay(creativeId, c) }.sortedBy { it.creativeId },
                )
            }
            .sortedWith(compareBy<CampaignDay> { it.date }.thenBy { it.campaignId })
    }

    override fun execute(from: LocalDate, to: LocalDate): List<PlacementDay> {
        val (start, until) = range(from, to)
        val delivery = reportPort.paidCreativeHours(start, until)
        val revenue = publisherRevenue(delivery, start, until)
        val deliveryByDay = delivery.groupBy { it.placementKey to it.hourKst.toLocalDate() }
        val requestsByDay = reportPort.placementHours(start, until).groupBy { it.placementKey to it.hourKst.toLocalDate() }

        // 요청 행이 없어도 노출·몫이 있는 (지면, 날)은 빠뜨리지 않는다 — 두 집계 표는 따로 채워진다.
        return (requestsByDay.keys + deliveryByDay.keys + revenue.keys)
            .map { key ->
                val rows = requestsByDay[key].orEmpty()
                val requests = rows.sumOf { it.requests }
                val paidFilled = rows.sumOf { it.paidFilled }
                val served = deliveryByDay[key].orEmpty()
                val publisherRevenue = revenue[key] ?: 0
                PlacementDay(
                    placementKey = key.first,
                    date = key.second,
                    requests = requests,
                    paidFilled = paidFilled,
                    paidFillRate = if (requests == 0L) 0.0 else paidFilled.toDouble() / requests,
                    clientReportedFill = ClientReportedFill(
                        paid = rows.sumOf { it.reportedPaid },
                        adsense = rows.sumOf { it.reportedAdsense },
                        house = rows.sumOf { it.reportedHouse },
                        empty = rows.sumOf { it.reportedEmpty },
                    ),
                    impressions = served.sumOf { it.impressions },
                    clicks = served.sumOf { it.clicks },
                    publisherRevenueMicros = publisherRevenue,
                    rpmMicros = if (requests == 0L) 0 else publisherRevenue * RPM_UNIT / requests,
                )
            }
            .sortedWith(compareBy<PlacementDay> { it.date }.thenBy { it.placementKey })
    }

    /** (지면, 날) → 퍼블리셔 몫. (캠페인, 시각)의 퍼블리셔 분개를 그 시각의 지면별 지출 비율로 나눈다(내림). */
    private fun publisherRevenue(delivery: List<CreativeHourRow>, start: LocalDateTime, until: LocalDateTime): Map<Pair<String, LocalDate>, Long> {
        val spendByCampaignHour = delivery.groupBy { it.campaignId to it.hourKst }
        val result = mutableMapOf<Pair<String, LocalDate>, Long>()
        reportPort.publisherShares(start, until).forEach { share ->
            val rows = spendByCampaignHour[share.campaignId to share.hourKst].orEmpty()
            val total = rows.sumOf { it.spendMicros }
            if (total <= 0) return@forEach
            rows.groupBy { it.placementKey }.forEach { (placementKey, p) ->
                val allocated = Math.multiplyExact(share.publisherShareMicros, p.sumOf { it.spendMicros }) / total
                result.merge(placementKey to share.hourKst.toLocalDate(), allocated, Long::plus)
            }
        }
        return result
    }

    private fun creativeDay(creativeId: Long, rows: List<CreativeHourRow>): CreativeDay {
        val impressions = rows.sumOf { it.impressions }
        val clicks = rows.sumOf { it.clicks }
        return CreativeDay(creativeId, impressions, clicks, ctr(clicks, impressions), rows.sumOf { it.spendMicros })
    }

    private fun ctr(clicks: Long, impressions: Long): Double = if (impressions == 0L) 0.0 else clicks.toDouble() / impressions

    private fun range(from: LocalDate, to: LocalDate): Pair<LocalDateTime, LocalDateTime> {
        if (to.isBefore(from)) throw BusinessException(ErrorCode.INVALID_INPUT, "기간의 끝이 시작보다 앞입니다")
        if (ChronoUnit.DAYS.between(from, to) >= MAX_DAYS) throw BusinessException(ErrorCode.INVALID_INPUT, "리포트 기간은 ${MAX_DAYS}일 이하여야 합니다")
        return from.atStartOfDay() to to.plusDays(1).atStartOfDay()
    }

    private companion object {
        const val MAX_DAYS = 92L
        const val RPM_UNIT = 1_000L
    }
}
