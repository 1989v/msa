package com.kgd.ads.application.report.dto

import java.time.LocalDateTime

/** 소재×지면 시간별 집계 한 행. */
data class CreativeHourRow(
    val creativeId: Long,
    val campaignId: Long,
    val placementKey: String,
    val hourKst: LocalDateTime,
    val impressions: Long,
    val clicks: Long,
    val spendMicros: Long,
)

/** (캠페인, 시각) 정산 기록 — 이 행이 있는 시각만 정산된 것이다. */
data class SettlementHourRow(val campaignId: Long, val hourKst: LocalDateTime, val spendMicros: Long, val chargedMicros: Long)

/** 지면 시간별 집계. reported* 는 화면이 보고한 최종 채움 출처(참고치). */
data class PlacementHourRow(
    val placementKey: String,
    val hourKst: LocalDateTime,
    val requests: Long,
    val paidFilled: Long,
    val reportedPaid: Long,
    val reportedAdsense: Long,
    val reportedHouse: Long,
    val reportedEmpty: Long,
)

/** (캠페인, 시각) 정산 거래에서 퍼블리셔 미지급 원장 계정으로 간 금액. */
data class PublisherShareRow(val campaignId: Long, val hourKst: LocalDateTime, val publisherShareMicros: Long)

data class SpendTotals(val spendMicros: Long, val chargedMicros: Long)
