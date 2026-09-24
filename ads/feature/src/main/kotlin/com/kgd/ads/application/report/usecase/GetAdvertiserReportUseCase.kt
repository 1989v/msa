package com.kgd.ads.application.report.usecase

import java.time.LocalDate

/**
 * 광고주 리포트 — 캠페인별 일별(KST) 가시 노출·클릭·CTR·지출·청구액, 그 아래 소재별 같은 값(청구액 제외 — 정산은 캠페인 단위다).
 * 그 날 정산 안 된 시각이 하나라도 있으면 청구액을 비운다. 다 정산됐는데 지출과 청구액이 다르면 「예산 초과분 미청구」다.
 */
interface GetAdvertiserReportUseCase {
    fun execute(memberId: Long, from: LocalDate, to: LocalDate): List<CampaignDay>

    data class CampaignDay(
        val campaignId: Long,
        val campaignName: String,
        val date: LocalDate,
        val impressions: Long,
        val clicks: Long,
        val ctr: Double,
        val spendMicros: Long,
        val chargedMicros: Long?,
        val unbilledOverBudget: Boolean,
        val creatives: List<CreativeDay>,
    )

    data class CreativeDay(val creativeId: Long, val impressions: Long, val clicks: Long, val ctr: Double, val spendMicros: Long)
}
