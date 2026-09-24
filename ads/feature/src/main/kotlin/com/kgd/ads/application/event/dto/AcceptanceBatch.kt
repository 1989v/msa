package com.kgd.ads.application.event.dto

import com.kgd.ads.domain.placement.model.FillSource
import com.kgd.ads.domain.token.model.ServedAd
import com.kgd.ads.domain.token.model.TokenKind
import java.time.LocalDateTime

/**
 * 이벤트 수락 한 번에 Redis 로 보내는 것 전부 — 서명·방문자·과금 여부를 통과한 이벤트와 그 캠페인들의 예산 한도.
 * 일회성 표식·예산 확인·카운터 증가는 이것 하나로 한 번에 한다(검사와 증가 사이에 다른 요청이 끼지 않게).
 *
 * @param hour 수락 시각(KST)의 시각 — 모든 카운터 키의 시각
 * @param budgets 캠페인 id → 예산 한도. [events] 의 모든 캠페인이 있다
 * @param clickRate 클릭 속도 제한. 클릭 이벤트에만 쓴다
 */
data class AcceptanceBatch(
    val hour: LocalDateTime,
    val budgets: Map<Long, CampaignBudget>,
    val events: List<BillableEvent>,
    val fills: Map<String, FillSource>,
    val clickRate: ClickRate?,
)

/**
 * 수락 시점에 캠페인이 더 받을 수 있는 몫. 청구 누계는 인덱스 스냅샷에서 이미 뺐고,
 * 스냅샷의 정산 완료 시각 뒤 지출은 Redis 가 [unsettledHoursToday]·[unsettledHoursEarlier] 키로 더한다.
 *
 * @param dailyRemainingMicros 일예산 − 오늘 청구 누계
 * @param totalRemainingMicros 총예산 − 청구 누계. 총예산이 없으면 null
 * @param unsettledHoursToday 수락 시각을 뺀 오늘의 미정산 시각
 * @param unsettledHoursEarlier 어제 이전의 미정산 시각
 */
data class CampaignBudget(
    val dailyRemainingMicros: Long,
    val totalRemainingMicros: Long?,
    val hourlyCapMicros: Long,
    val unsettledHoursToday: List<LocalDateTime>,
    val unsettledHoursEarlier: List<LocalDateTime>,
)

/** 서명을 통과한 이벤트 한 건. [chargeMicros] 는 이 이벤트가 청구하는 금액(반대쪽 이벤트면 0). */
data class BillableEvent(val kind: TokenKind, val ad: ServedAd, val chargeMicros: Long)

/** 같은 방문자의 클릭은 [windowStart] 부터 10분 동안 [limit] 회까지만 과금한다. */
data class ClickRate(val visitorHash: String, val windowStart: LocalDateTime, val limit: Int)

/** Redis 가 이벤트마다 내린 판정. */
enum class AcceptanceOutcome { ACCEPTED, DUPLICATE, OVER_BUDGET, RATE_LIMITED }
