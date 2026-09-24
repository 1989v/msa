package com.kgd.ads.infrastructure.persistence.settlement.adapter

import com.kgd.ads.application.settlement.dto.CampaignBudget
import com.kgd.ads.application.settlement.dto.CampaignHourSpend
import com.kgd.ads.application.settlement.dto.SettlementRecord
import com.kgd.ads.application.settlement.port.SettlementPort
import com.kgd.ads.domain.advertiser.model.AdvertiserKind
import com.kgd.ads.infrastructure.persistence.campaign.repository.CampaignJpaRepository
import com.kgd.ads.infrastructure.persistence.settlement.entity.SettlementJpaEntity
import com.kgd.ads.infrastructure.persistence.settlement.repository.AdvertiserSettledThroughJpaRepository
import com.kgd.ads.infrastructure.persistence.settlement.repository.SettlementJpaRepository
import com.kgd.ads.infrastructure.persistence.stats.repository.CreativeHourlyJpaRepository
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

@Component
class SettlementRepositoryAdapter(
    private val creativeHourlyRepository: CreativeHourlyJpaRepository,
    private val settlementRepository: SettlementJpaRepository,
    private val settledThroughRepository: AdvertiserSettledThroughJpaRepository,
    private val campaignRepository: CampaignJpaRepository,
) : SettlementPort {

    override fun findUnsettled(): List<CampaignHourSpend> =
        creativeHourlyRepository.findClosedUnsettled(AdvertiserKind.MEMBER)
            .map { CampaignHourSpend(it.campaignId, it.advertiserId, it.hourKst, it.spendMicros) }

    override fun exists(campaignId: Long, hourKst: LocalDateTime): Boolean =
        settlementRepository.existsByCampaignIdAndHourKst(campaignId, hourKst)

    override fun budgetOf(campaignId: Long): CampaignBudget {
        val campaign = campaignRepository.findById(campaignId).orElseThrow { IllegalStateException("캠페인 없음: $campaignId") }
        val daily = requireNotNull(campaign.dailyBudgetMicros) { "일예산 없는 캠페인은 정산 대상이 아니다: $campaignId" }
        return CampaignBudget(daily, campaign.totalBudgetMicros)
    }

    override fun chargedBetween(campaignId: Long, from: LocalDateTime, until: LocalDateTime): Long =
        settlementRepository.sumChargedBetween(campaignId, from, until)

    override fun chargedTotal(campaignId: Long): Long = settlementRepository.sumChargedOf(campaignId)

    override fun record(record: SettlementRecord) {
        settlementRepository.save(
            SettlementJpaEntity(
                campaignId = record.campaignId,
                advertiserId = record.advertiserId,
                hourKst = record.hourKst,
                spendMicros = record.spendMicros,
                chargedMicros = record.chargedMicros,
                transactionId = record.transactionId,
                createdAt = record.createdAt,
            ),
        )
    }

    @Transactional("adsTransactionManager")
    override fun updateSettledThrough(default: LocalDateTime, overrides: Map<Long, LocalDateTime>, now: LocalDateTime) {
        settledThroughRepository.upsertAllMembers(default, now)
        overrides.forEach { (advertiserId, hour) -> settledThroughRepository.upsert(advertiserId, hour, now) }
    }
}
