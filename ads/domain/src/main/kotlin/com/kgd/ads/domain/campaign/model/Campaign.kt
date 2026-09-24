package com.kgd.ads.domain.campaign.model

import com.kgd.ads.domain.advertiser.model.Advertiser
import com.kgd.ads.domain.advertiser.model.AdvertiserKind
import com.kgd.ads.domain.campaign.exception.InvalidCampaignException
import com.kgd.ads.domain.placement.model.AdPlacement
import java.time.LocalDateTime

/**
 * 캠페인. 우선순위는 저장하지 않고 소유 광고주 종류에서 파생한다(`SYSTEM` → HOUSE).
 *
 * PAID 는 [draftPaid] 로만, HOUSE 는 [draftHouse] 로만 만든다 — HOUSE 팩토리에는 입찰·예산·빈도
 * 인자가 없어 HOUSE 가 예산을 갖는 조합을 만들 수 없다.
 *
 * 「기간 밖」·「예산 소진」은 상태로 두지 않는다. 상태를 바꾸면 기간이 늘거나 예산이 채워졌을 때
 * 누가 되돌릴지가 생기므로, [isRunningAt]·[hasBudgetFor]·[isUnderHourlyCap]·[isUnderFrequencyCap] 가 매번 파생한다.
 */
class Campaign private constructor(
    val id: Long?,
    val advertiserId: Long,
    val advertiserKind: AdvertiserKind,
    val name: String,
    status: CampaignStatus,
    val bid: Bid?,
    val dailyBudgetMicros: Long?,
    val totalBudgetMicros: Long?,
    val startAt: LocalDateTime,
    val endAt: LocalDateTime?,
    val frequencyCapPerDay: Int?,
    val placementKeys: Set<String>,
    val categoryCodes: Set<String>,
) {
    var status: CampaignStatus = status
        private set

    val priority: CampaignPriority
        get() = if (advertiserKind == AdvertiserKind.SYSTEM) CampaignPriority.HOUSE else CampaignPriority.PAID

    init {
        if (name.isBlank() || name.length > MAX_NAME_LENGTH) invalid("캠페인 이름은 1~${MAX_NAME_LENGTH}자여야 합니다")
        if (placementKeys.isEmpty()) invalid("타기팅 지면이 하나 이상 있어야 합니다")
        if (endAt != null && !endAt.isAfter(startAt)) invalid("종료 시각은 시작 시각보다 뒤여야 합니다")
        when (priority) {
            CampaignPriority.PAID -> {
                if (bid == null || dailyBudgetMicros == null || frequencyCapPerDay == null) {
                    invalid("유료 캠페인은 입찰·일예산·빈도 제한이 있어야 합니다")
                }
                if (dailyBudgetMicros < bid.chargeMicros) invalid("일예산은 1회 과금액(${bid.chargeMicros}) 이상이어야 합니다")
                if (totalBudgetMicros != null && totalBudgetMicros <= 0) invalid("총예산은 0 보다 커야 합니다")
                if (frequencyCapPerDay <= 0) invalid("빈도 제한은 1 이상이어야 합니다")
            }
            CampaignPriority.HOUSE -> {
                if (bid != null || dailyBudgetMicros != null || totalBudgetMicros != null || frequencyCapPerDay != null) {
                    invalid("HOUSE 캠페인은 입찰·예산·빈도를 갖지 않습니다")
                }
            }
        }
    }

    fun start() = transition(CampaignStatus.ACTIVE, from = setOf(CampaignStatus.DRAFT))

    fun pause() = transition(CampaignStatus.PAUSED, from = setOf(CampaignStatus.ACTIVE))

    fun resume() = transition(CampaignStatus.ACTIVE, from = setOf(CampaignStatus.PAUSED))

    fun end() = transition(CampaignStatus.ENDED, from = setOf(CampaignStatus.DRAFT, CampaignStatus.ACTIVE, CampaignStatus.PAUSED))

    /**
     * 게재를 켜기 전(시작·재개) 저장 불변식을 지금의 지면 값으로 다시 확인한다 — 저장 뒤 최저가가 오르거나
     * 지면이 HOUSE 전용으로 바뀌었으면 켜지 않는다. 멈추는 전이(일시정지·종료)는 확인하지 않는다: 멈추는 것은 항상 되어야 한다.
     * [placements] 는 이 캠페인이 타기팅한 지면 전부여야 한다.
     */
    fun verifyTargeting(placements: List<AdPlacement>) {
        if (placements.map { it.key }.toSet() != placementKeys) invalid("타기팅 지면 중 등록부에 없는 것이 있습니다")
        if (priority == CampaignPriority.PAID) requirePaidTargeting(requireNotNull(bid), placements)
    }

    /**
     * 유료 캠페인의 내용을 바꾼 새 값. 상태는 그대로이고, 저장 불변식은 [draftPaid] 와 같은 검사를 다시 거친다.
     * 종료된 캠페인은 고칠 수 없다.
     */
    fun revisePaid(
        advertiser: Advertiser,
        name: String,
        bid: Bid,
        dailyBudgetMicros: Long,
        totalBudgetMicros: Long?,
        startAt: LocalDateTime,
        endAt: LocalDateTime?,
        placements: List<AdPlacement>,
        categoryCodes: Set<String>,
        frequencyCapPerDay: Int,
    ): Campaign {
        if (status == CampaignStatus.ENDED) invalid("종료된 캠페인은 고칠 수 없습니다")
        if (advertiser.id != advertiserId) invalid("다른 광고주의 캠페인입니다")
        val revised = draftPaid(
            advertiser, name, bid, dailyBudgetMicros, totalBudgetMicros, startAt, endAt, placements, categoryCodes, frequencyCapPerDay,
        )
        return restore(
            requireNotNull(id), advertiserId, advertiserKind, revised.name, status, revised.bid, revised.dailyBudgetMicros,
            revised.totalBudgetMicros, revised.startAt, revised.endAt, revised.frequencyCapPerDay, revised.placementKeys, revised.categoryCodes,
        )
    }

    /** 상태가 ACTIVE 이고 `[startAt, endAt)` 안이면 게재 기간이다. */
    fun isRunningAt(now: LocalDateTime): Boolean =
        status == CampaignStatus.ACTIVE && !now.isBefore(startAt) && (endAt == null || now.isBefore(endAt))

    /**
     * 1회 과금액을 더 받아도 일예산·총예산을 넘지 않는지. 지출은 **청구 누계 + 미정산 지출**로 넘긴다 —
     * 청구만 보면 정산이 늦는 동안 예산을 넘겨 게재한다. HOUSE 는 예산이 없어 항상 true.
     */
    fun hasBudgetFor(spentTodayMicros: Long, spentTotalMicros: Long): Boolean {
        val charge = bid?.chargeMicros ?: return true
        val daily = requireNotNull(dailyBudgetMicros)
        if (spentTodayMicros > daily - charge) return false
        return totalBudgetMicros == null || spentTotalMicros <= totalBudgetMicros - charge
    }

    /**
     * 시간당 지출 상한 = max(floor(일예산 × 25%), 1회 과금액). 몰아 쓰기 손실의 상한이다.
     * 1회 과금액을 하한으로 두는 것은 일예산이 작을 때 상한이 과금 1회보다 작아 영영 게재되지 않는 것을 막기 위해서다.
     * HOUSE 는 상한이 없어 null.
     */
    val hourlyCapMicros: Long?
        get() {
            val daily = dailyBudgetMicros ?: return null
            return maxOf(daily * HOURLY_CAP_PERCENT / 100, requireNotNull(bid).chargeMicros)
        }

    /** 이번 시각 지출이 시간당 상한에 못 미치는지. */
    fun isUnderHourlyCap(spentThisHourMicros: Long): Boolean {
        val cap = hourlyCapMicros ?: return true
        return spentThisHourMicros < cap
    }

    /** 지면 문맥 카테고리에 맞는지. 타기팅 카테고리가 비면 전체다. 문맥을 모르는(null) 지면에는 전체 타기팅만 맞는다. */
    fun matchesCategory(categoryCode: String?): Boolean =
        categoryCodes.isEmpty() || (categoryCode != null && categoryCode in categoryCodes)

    /** 이 방문자가 오늘 이 캠페인을 본 횟수가 빈도 제한에 못 미치는지. HOUSE 는 빈도 제한이 없다. */
    fun isUnderFrequencyCap(viewsToday: Long): Boolean {
        val cap = frequencyCapPerDay ?: return true
        return viewsToday < cap
    }

    private fun transition(to: CampaignStatus, from: Set<CampaignStatus>) {
        if (status !in from) invalid("캠페인 상태 전이 불가: $status → $to")
        status = to
    }

    companion object {
        const val MAX_NAME_LENGTH = 100
        const val DEFAULT_FREQUENCY_CAP_PER_DAY = 3
        const val HOURLY_CAP_PERCENT = 25L

        private fun invalid(message: String): Nothing = throw InvalidCampaignException(message)

        private fun requirePaidTargeting(bid: Bid, placements: List<AdPlacement>) {
            placements.firstOrNull { !it.paidAllowed }?.let {
                invalid("지면 ${it.key} 는 유료 광고를 받지 않습니다")
            }
            if (bid.type == BidType.CPM) {
                placements.firstOrNull { bid.micros < it.floorMicros }?.let {
                    invalid("입찰가가 지면 ${it.key} 의 최저가(${it.floorMicros})보다 낮습니다")
                }
            }
        }

        /**
         * 회원 광고주의 유료 캠페인을 DRAFT 로 만든다.
         *
         * - CPM 입찰가는 타기팅한 **모든** 지면의 최저가 이상이어야 한다 — 저장 뒤 최저가가 오르면 결정이 그 지면을 뺀다.
         *   CPC 는 클릭 단가라 노출 천 회 단위인 최저가와 단위가 달라 여기서 비교하지 않고, 결정 때 eCPM 으로 비교한다
         * - 유료를 받지 않는 지면(HOUSE 전용)은 타기팅할 수 없다 — 경매에서만 빼면 광고주는 왜 안 나가는지 모른다
         */
        fun draftPaid(
            advertiser: Advertiser,
            name: String,
            bid: Bid,
            dailyBudgetMicros: Long,
            totalBudgetMicros: Long?,
            startAt: LocalDateTime,
            endAt: LocalDateTime?,
            placements: List<AdPlacement>,
            categoryCodes: Set<String>,
            frequencyCapPerDay: Int = DEFAULT_FREQUENCY_CAP_PER_DAY,
        ): Campaign {
            if (advertiser.kind != AdvertiserKind.MEMBER) invalid("유료 캠페인은 회원 광고주만 만듭니다")
            requirePaidTargeting(bid, placements)
            return Campaign(
                id = null,
                advertiserId = requireNotNull(advertiser.id) { "저장되지 않은 광고주" },
                advertiserKind = advertiser.kind,
                name = name.trim(),
                status = CampaignStatus.DRAFT,
                bid = bid,
                dailyBudgetMicros = dailyBudgetMicros,
                totalBudgetMicros = totalBudgetMicros,
                startAt = startAt,
                endAt = endAt,
                frequencyCapPerDay = frequencyCapPerDay,
                placementKeys = placements.map { it.key }.toSet(),
                categoryCodes = categoryCodes,
            )
        }

        /** 「1989v 하우스」의 HOUSE 캠페인. 예산·지갑·최저가·빈도·원장에서 면제된다. */
        fun draftHouse(
            advertiser: Advertiser,
            name: String,
            startAt: LocalDateTime,
            endAt: LocalDateTime?,
            placementKeys: Set<String>,
            categoryCodes: Set<String>,
        ): Campaign {
            if (advertiser.kind != AdvertiserKind.SYSTEM) invalid("HOUSE 캠페인은 SYSTEM 광고주만 만듭니다")
            return Campaign(
                id = null,
                advertiserId = requireNotNull(advertiser.id) { "저장되지 않은 광고주" },
                advertiserKind = advertiser.kind,
                name = name.trim(),
                status = CampaignStatus.DRAFT,
                bid = null,
                dailyBudgetMicros = null,
                totalBudgetMicros = null,
                startAt = startAt,
                endAt = endAt,
                frequencyCapPerDay = null,
                placementKeys = placementKeys,
                categoryCodes = categoryCodes,
            )
        }

        fun restore(
            id: Long,
            advertiserId: Long,
            advertiserKind: AdvertiserKind,
            name: String,
            status: CampaignStatus,
            bid: Bid?,
            dailyBudgetMicros: Long?,
            totalBudgetMicros: Long?,
            startAt: LocalDateTime,
            endAt: LocalDateTime?,
            frequencyCapPerDay: Int?,
            placementKeys: Set<String>,
            categoryCodes: Set<String>,
        ): Campaign = Campaign(
            id, advertiserId, advertiserKind, name, status, bid, dailyBudgetMicros, totalBudgetMicros,
            startAt, endAt, frequencyCapPerDay, placementKeys, categoryCodes,
        )
    }
}
