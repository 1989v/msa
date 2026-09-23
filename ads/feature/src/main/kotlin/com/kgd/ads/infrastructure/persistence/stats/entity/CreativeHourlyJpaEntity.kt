package com.kgd.ads.infrastructure.persistence.stats.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.IdClass
import jakarta.persistence.Table
import java.io.Serializable
import java.time.LocalDateTime

/** 소재×지면 시간별 집계. 예상 클릭률이 이 표의 가시 노출·클릭 합에서 나온다. */
@Entity
@Table(name = "ad_creative_hourly")
@IdClass(CreativeHourlyJpaEntity.Key::class)
class CreativeHourlyJpaEntity(
    @Id
    @Column(name = "creative_id", nullable = false)
    val creativeId: Long,

    @Id
    @Column(name = "placement_key", nullable = false, length = 64)
    val placementKey: String,

    @Id
    @Column(name = "hour_kst", nullable = false)
    val hourKst: LocalDateTime,

    @Column(name = "campaign_id", nullable = false)
    val campaignId: Long,

    @Column(name = "advertiser_id", nullable = false)
    val advertiserId: Long,

    @Column(name = "impressions", nullable = false)
    val impressions: Long,

    @Column(name = "clicks", nullable = false)
    val clicks: Long,

    @Column(name = "spend_micros", nullable = false)
    val spendMicros: Long,

    @Column(name = "closed_at")
    val closedAt: LocalDateTime?,

    @Column(name = "updated_at", nullable = false)
    val updatedAt: LocalDateTime,
) {
    data class Key(
        val creativeId: Long = 0,
        val placementKey: String = "",
        val hourKst: LocalDateTime = LocalDateTime.MIN,
    ) : Serializable
}
