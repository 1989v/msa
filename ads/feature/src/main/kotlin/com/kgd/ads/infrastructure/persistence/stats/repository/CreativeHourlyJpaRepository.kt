package com.kgd.ads.infrastructure.persistence.stats.repository

import com.kgd.ads.domain.advertiser.model.AdvertiserKind
import com.kgd.ads.infrastructure.persistence.stats.entity.CreativeHourlyJpaEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.LocalDateTime

interface CreativeHourlyJpaRepository : JpaRepository<CreativeHourlyJpaEntity, CreativeHourlyJpaEntity.Key> {

    /** 소재×지면별 가시 노출·클릭 합 — 예상 클릭률의 입력. */
    @Query(
        "select h.creativeId as creativeId, h.placementKey as placementKey, " +
            "sum(h.impressions) as impressions, sum(h.clicks) as clicks from CreativeHourlyJpaEntity h " +
            "where h.creativeId in :creativeIds group by h.creativeId, h.placementKey",
    )
    fun sumDelivery(@Param("creativeIds") creativeIds: Collection<Long>): List<CreativeDeliverySum>

    /** 닫혔고 정산 기록이 없는 (캠페인, 시각)의 지출 합 — [kind] 광고주 것만. 시각 오름차순. */
    @Query(
        "select h.campaignId as campaignId, h.advertiserId as advertiserId, h.hourKst as hourKst, " +
            "sum(h.spendMicros) as spendMicros from CreativeHourlyJpaEntity h, AdvertiserJpaEntity a " +
            "where a.id = h.advertiserId and a.kind = :kind and h.closedAt is not null " +
            "and not exists (select s.id from SettlementJpaEntity s where s.campaignId = h.campaignId and s.hourKst = h.hourKst) " +
            "group by h.campaignId, h.advertiserId, h.hourKst order by h.hourKst, h.campaignId",
    )
    fun findClosedUnsettled(@Param("kind") kind: AdvertiserKind): List<CampaignHourSpendRow>
}

interface CampaignHourSpendRow {
    val campaignId: Long
    val advertiserId: Long
    val hourKst: LocalDateTime
    val spendMicros: Long
}

interface CreativeDeliverySum {
    val creativeId: Long
    val placementKey: String
    val impressions: Long
    val clicks: Long
}
