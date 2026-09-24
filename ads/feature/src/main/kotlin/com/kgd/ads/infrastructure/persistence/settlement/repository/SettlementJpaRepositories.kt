package com.kgd.ads.infrastructure.persistence.settlement.repository

import com.kgd.ads.infrastructure.persistence.settlement.entity.AdvertiserSettledThroughJpaEntity
import com.kgd.ads.infrastructure.persistence.settlement.entity.SettlementJpaEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
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

    fun existsByCampaignIdAndHourKst(campaignId: Long, hourKst: LocalDateTime): Boolean

    /** 한 캠페인의 [from, until) 시각 청구 합. */
    @Query(
        "select coalesce(sum(s.chargedMicros), 0) from SettlementJpaEntity s " +
            "where s.campaignId = :campaignId and s.hourKst >= :from and s.hourKst < :until",
    )
    fun sumChargedBetween(
        @Param("campaignId") campaignId: Long,
        @Param("from") from: LocalDateTime,
        @Param("until") until: LocalDateTime,
    ): Long

    @Query("select coalesce(sum(s.chargedMicros), 0) from SettlementJpaEntity s where s.campaignId = :campaignId")
    fun sumChargedOf(@Param("campaignId") campaignId: Long): Long
}

interface CampaignChargedSum {
    val campaignId: Long
    val chargedMicros: Long
}

interface AdvertiserSettledThroughJpaRepository : JpaRepository<AdvertiserSettledThroughJpaEntity, Long> {

    /** MEMBER 광고주 전부의 정산 완료 시각을 [hour] 로 — 지출이 없던 광고주도 행을 갖는다. */
    @Modifying
    @Query(
        nativeQuery = true,
        value = "INSERT INTO ad_advertiser_settled_through (advertiser_id, settled_through_hour_kst, updated_at) " +
            "SELECT id, :hour, :now FROM ad_advertiser WHERE kind = 'MEMBER' " +
            "ON DUPLICATE KEY UPDATE settled_through_hour_kst = :hour, updated_at = :now",
    )
    fun upsertAllMembers(@Param("hour") hour: LocalDateTime, @Param("now") now: LocalDateTime): Int

    @Modifying
    @Query(
        nativeQuery = true,
        value = "INSERT INTO ad_advertiser_settled_through (advertiser_id, settled_through_hour_kst, updated_at) " +
            "VALUES (:advertiserId, :hour, :now) ON DUPLICATE KEY UPDATE settled_through_hour_kst = :hour, updated_at = :now",
    )
    fun upsert(@Param("advertiserId") advertiserId: Long, @Param("hour") hour: LocalDateTime, @Param("now") now: LocalDateTime): Int
}
