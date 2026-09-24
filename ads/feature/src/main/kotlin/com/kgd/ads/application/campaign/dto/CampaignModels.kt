package com.kgd.ads.application.campaign.dto

import com.kgd.ads.domain.campaign.model.BidType
import com.kgd.ads.domain.campaign.model.Campaign
import com.kgd.ads.domain.campaign.model.CampaignStatus
import java.time.LocalDateTime

/**
 * 광고주가 정하는 유료 캠페인 값. 우선순위·심사 상태·원장 계정은 여기 없다 — 우선순위는 소유 광고주 종류에서,
 * 상태는 전이 명령에서만 정해진다.
 */
data class PaidCampaignDraft(
    val name: String,
    val bidType: BidType,
    val bidMicros: Long,
    val dailyBudgetMicros: Long,
    val totalBudgetMicros: Long?,
    val startAt: LocalDateTime,
    val endAt: LocalDateTime?,
    val frequencyCapPerDay: Int?,
    val placementKeys: Set<String>,
    val categoryCodes: Set<String>,
)

data class HouseCampaignDraft(
    val name: String,
    val startAt: LocalDateTime,
    val endAt: LocalDateTime?,
    val placementKeys: Set<String>,
    val categoryCodes: Set<String>,
)

/** 상태 전이 명령. 시작(DRAFT→ACTIVE)·재개(PAUSED→ACTIVE)는 저장 불변식을 지금의 지면 값으로 다시 확인한다. */
enum class CampaignAction { START, PAUSE, RESUME, END }

/**
 * @param inPeriod 지금이 게재 기간 안인지 — 「기간 밖」은 상태가 아니라 파생 표시다
 */
data class CampaignView(
    val id: Long,
    val name: String,
    val status: CampaignStatus,
    val bidType: BidType?,
    val bidMicros: Long?,
    val dailyBudgetMicros: Long?,
    val totalBudgetMicros: Long?,
    val startAt: LocalDateTime,
    val endAt: LocalDateTime?,
    val frequencyCapPerDay: Int?,
    val placementKeys: List<String>,
    val categoryCodes: List<String>,
    val inPeriod: Boolean,
) {
    companion object {
        fun of(campaign: Campaign, now: LocalDateTime) = CampaignView(
            id = requireNotNull(campaign.id),
            name = campaign.name,
            status = campaign.status,
            bidType = campaign.bid?.type,
            bidMicros = campaign.bid?.micros,
            dailyBudgetMicros = campaign.dailyBudgetMicros,
            totalBudgetMicros = campaign.totalBudgetMicros,
            startAt = campaign.startAt,
            endAt = campaign.endAt,
            frequencyCapPerDay = campaign.frequencyCapPerDay,
            placementKeys = campaign.placementKeys.sorted(),
            categoryCodes = campaign.categoryCodes.sorted(),
            inPeriod = !now.isBefore(campaign.startAt) && (campaign.endAt == null || now.isBefore(campaign.endAt)),
        )
    }
}
