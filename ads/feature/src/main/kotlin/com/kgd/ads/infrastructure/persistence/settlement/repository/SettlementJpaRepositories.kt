package com.kgd.ads.infrastructure.persistence.settlement.repository

import com.kgd.ads.infrastructure.persistence.settlement.entity.AdvertiserSettledThroughJpaEntity
import com.kgd.ads.infrastructure.persistence.settlement.entity.SettlementJpaEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.LocalDateTime

interface SettlementJpaRepository : JpaRepository<SettlementJpaEntity, Long> {

    /** 캠페인별 청구 누계(전체 기간). */
    @Query(
        "select s.campaignId as campaignId, sum(s.chargedMicros) as chargedMicros from SettlementJpaEntity s " +
            "where s.campaignId in :campaignIds group by s.campaignId",
    )
    fun sumCharged(@Param("campaignIds") campaignIds: Collection<Long>): List<CampaignChargedSum>

    /** 캠페인별 청구 누계 — `from` 시각 이후만(하루 청구 누계용). */
    @Query(
        "select s.campaignId as campaignId, sum(s.chargedMicros) as chargedMicros from SettlementJpaEntity s " +
            "where s.campaignId in :campaignIds and s.hourKst >= :from group by s.campaignId",
    )
    fun sumChargedSince(
        @Param("campaignIds") campaignIds: Collection<Long>,
        @Param("from") from: LocalDateTime,
    ): List<CampaignChargedSum>
}

interface CampaignChargedSum {
    val campaignId: Long
    val chargedMicros: Long
}

interface AdvertiserSettledThroughJpaRepository : JpaRepository<AdvertiserSettledThroughJpaEntity, Long>
