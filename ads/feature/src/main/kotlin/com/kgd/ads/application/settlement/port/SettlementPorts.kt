package com.kgd.ads.application.settlement.port

import com.kgd.ads.application.settlement.dto.CampaignBudget
import com.kgd.ads.application.settlement.dto.CampaignHourSpend
import com.kgd.ads.application.settlement.dto.HourCounters
import com.kgd.ads.application.settlement.dto.SettlementRecord
import java.time.LocalDateTime

interface HourCounterPort {
    /** 한 시각의 카운터를 읽는다. 키가 없으면(만료·무트래픽) 빈 값. 읽기 실패는 예외 — 그 시각은 이번 실행에서 반영하지 않는다. */
    fun read(hour: LocalDateTime, placementKeys: Collection<String>): HourCounters
}

interface HourlyStatsPort {
    /** 등록부의 지면 키 전부(비활성 포함) — 지면 카운터를 읽을 키 목록. */
    fun registeredPlacementKeys(): List<String>

    /** [from, until] 안에서 닫힌 시각. */
    fun closedHours(from: LocalDateTime, until: LocalDateTime): Set<LocalDateTime>

    /** [before] 보다 이른데 아직 닫히지 않은 집계 행이 있는 시각 — 작업이 카운터 수명보다 오래 멈췄던 경우다. */
    fun unclosedHoursBefore(before: LocalDateTime): Set<LocalDateTime>

    /**
     * 한 시각의 카운터를 집계 표에 **절대값으로** 덮어쓴다. [closeAt] 이 있으면 같은 트랜잭션에서 그 시각을 닫는다 —
     * 닫힘 기록, 소재×지면 행의 `closed_at`, 미등록 지면 요청 수 누적(닫을 때 한 번). 덮어쓰기가 실패하면 닫지도 않는다.
     */
    fun save(hour: LocalDateTime, counters: HourCounters, closeAt: LocalDateTime?, now: LocalDateTime)
}

interface SettlementPort {
    /** 닫혔고 정산 기록이 없는 유료(MEMBER 광고주) (캠페인, 시각). 시각 오름차순. */
    fun findUnsettled(): List<CampaignHourSpend>

    fun exists(campaignId: Long, hourKst: LocalDateTime): Boolean

    fun budgetOf(campaignId: Long): CampaignBudget

    /** 캠페인의 [from, until) 시각 청구 합. */
    fun chargedBetween(campaignId: Long, from: LocalDateTime, until: LocalDateTime): Long

    fun chargedTotal(campaignId: Long): Long

    fun record(record: SettlementRecord)

    /**
     * MEMBER 광고주 전부의 「정산 완료 시각」을 [default] 로 두고, [overrides] 의 광고주는 그 값으로 둔다.
     * 지출이 없던 광고주도 기록해야 결정이 오래된 미정산으로 오판하지 않는다.
     */
    fun updateSettledThrough(default: LocalDateTime, overrides: Map<Long, LocalDateTime>, now: LocalDateTime)
}

interface SettlementMetricsPort {
    fun recordAggregated(at: LocalDateTime)
    fun recordSettled(at: LocalDateTime)
    fun recordLedgerImbalance(imbalanceMicros: Long)
}
