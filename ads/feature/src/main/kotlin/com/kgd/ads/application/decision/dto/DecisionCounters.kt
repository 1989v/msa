package com.kgd.ads.application.decision.dto

import java.time.LocalDate
import java.time.LocalDateTime

/**
 * 결정이 한 번에 읽는 실시간 값의 범위.
 *
 * @param campaignHours 캠페인 id → 지출을 읽을 시각들(정산 완료 시각 뒤 ~ 지금 시각)
 * @param advertiserHours 광고주 id → 지출을 읽을 시각들
 */
data class CounterQuery(
    val visitorHash: String,
    val day: LocalDate,
    val campaignIds: Set<Long>,
    val campaignHours: Map<Long, List<LocalDateTime>>,
    val advertiserHours: Map<Long, List<LocalDateTime>>,
)

/** [CounterQuery] 의 답. 키가 없으면 0 으로 읽는다. */
data class DecisionCounters(
    private val frequency: Map<Long, Long>,
    private val campaignSpend: Map<Long, Map<LocalDateTime, Long>>,
    private val advertiserSpend: Map<Long, Map<LocalDateTime, Long>>,
) {
    fun viewsToday(campaignId: Long): Long = frequency[campaignId] ?: 0

    fun campaignSpendByHour(campaignId: Long): Map<LocalDateTime, Long> = campaignSpend[campaignId].orEmpty()

    fun advertiserSpendByHour(advertiserId: Long): Map<LocalDateTime, Long> = advertiserSpend[advertiserId].orEmpty()

    companion object {
        val NONE = DecisionCounters(emptyMap(), emptyMap(), emptyMap())
    }
}

/** 결정 뒤 한 번에 올리는 지면 카운터. 키는 결정 시각(KST)의 시각. */
data class ServeTally(
    val hour: LocalDateTime,
    val requests: Map<String, Long>,
    val paidFilled: Map<String, Long>,
    val unregistered: Map<String, Long>,
)
