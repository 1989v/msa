package com.kgd.ads.infrastructure.persistence.settlement.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime

/** (캠페인, 시각) 정산 기록. 청구 누계는 이 표의 `charged_micros` 합이다. */
@Entity
@Table(name = "ad_settlement")
class SettlementJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "campaign_id", nullable = false)
    val campaignId: Long,

    @Column(name = "advertiser_id", nullable = false)
    val advertiserId: Long,

    @Column(name = "hour_kst", nullable = false)
    val hourKst: LocalDateTime,

    @Column(name = "spend_micros", nullable = false)
    val spendMicros: Long,

    @Column(name = "charged_micros", nullable = false)
    val chargedMicros: Long,

    @Column(name = "transaction_id")
    val transactionId: Long?,

    @Column(name = "created_at", nullable = false)
    val createdAt: LocalDateTime,
)

/** 광고주별 「정산 완료 시각」 — 이 시각(시작)까지의 지출이 원장에 반영됐다. */
@Entity
@Table(name = "ad_advertiser_settled_through")
class AdvertiserSettledThroughJpaEntity(
    @Id
    @Column(name = "advertiser_id", nullable = false)
    val advertiserId: Long,

    @Column(name = "settled_through_hour_kst", nullable = false)
    val settledThroughHourKst: LocalDateTime,

    @Column(name = "updated_at", nullable = false)
    val updatedAt: LocalDateTime,
)
