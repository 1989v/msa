package com.kgd.ads.application.settlement.dto

import java.time.LocalDateTime

/** 한 KST 시각의 Redis 카운터 전부 — 집계 표에 그대로(절대값으로) 옮긴다. */
data class HourCounters(
    val creatives: List<CreativeHourCount>,
    val placements: List<PlacementHourCount>,
    /** 미등록 지면 키 → 그 시각 요청 수 */
    val unregistered: Map<String, Long>,
)

data class CreativeHourCount(
    val creativeId: Long,
    val campaignId: Long,
    val advertiserId: Long,
    val placementKey: String,
    val impressions: Long,
    val clicks: Long,
    val spendMicros: Long,
)

/** 지면 시각 카운터. requests·paidFilled 는 서버가 센 값, reported* 는 화면이 보고한 최종 채움 출처(참고치). */
data class PlacementHourCount(
    val placementKey: String,
    val requests: Long,
    val paidFilled: Long,
    val reportedPaid: Long,
    val reportedAdsense: Long,
    val reportedHouse: Long,
    val reportedEmpty: Long,
)

/** 닫혔고 아직 정산 안 된 (캠페인, 시각)의 지출 합. */
data class CampaignHourSpend(
    val campaignId: Long,
    val advertiserId: Long,
    val hourKst: LocalDateTime,
    val spendMicros: Long,
)

/** 유료 캠페인의 예산. 총예산은 선택. */
data class CampaignBudget(val dailyBudgetMicros: Long, val totalBudgetMicros: Long?)

data class SettlementRecord(
    val campaignId: Long,
    val advertiserId: Long,
    val hourKst: LocalDateTime,
    val spendMicros: Long,
    val chargedMicros: Long,
    /** 청구액 0 이면 원장 거래가 없어 null */
    val transactionId: Long?,
    val createdAt: LocalDateTime,
)
