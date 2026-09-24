package com.kgd.ads.application.decision.dto

import com.kgd.ads.domain.campaign.model.Campaign
import com.kgd.ads.domain.creative.model.HouseCreativeContent
import com.kgd.ads.domain.creative.model.PaidCreativeContent
import com.kgd.ads.domain.decision.policy.WalletHeadroom
import com.kgd.ads.domain.placement.model.AdPlacement
import com.kgd.ads.domain.placement.model.AspectRatio
import java.time.LocalDate
import java.time.LocalDateTime

/**
 * 결정이 읽는 후보 인덱스 한 벌. 통째로 바꿔 끼우므로 결정 하나는 항상 한 시점의 값만 본다.
 *
 * 요청마다 달라지지 않는 자격(상태·승인·지면 타기팅·유료 허용·비율·eCPM ≥ 최저가)은 만들 때 이미 걸렀다.
 * 남은 것(기간·카테고리·예산·빈도·지갑·페이싱)은 결정이 요청 시각과 Redis 값으로 판정한다.
 */
class CandidateSnapshot(
    val loadedAt: LocalDateTime,
    val placements: Map<String, AdPlacement>,
    private val contextMappings: Map<String, String>,
    private val hostCategories: Map<String, String>,
    /** 지면 키 → 유료 후보, eCPM 내림차순 */
    val paidByPlacement: Map<String, List<PaidCandidate>>,
    val houseByPlacement: Map<String, List<HouseCandidate>>,
    val accounts: Map<Long, AdvertiserAccount>,
    private val chargedDay: LocalDate,
    private val chargedToday: Map<Long, Long>,
    private val chargedTotal: Map<Long, Long>,
) {
    /** 문맥 키가 매핑돼 있으면 그 카테고리, 아니면 호스트 기본 카테고리. 둘 다 없으면 null. */
    fun categoryOf(host: String, contextKey: String?): String? =
        contextKey?.takeIf { it.isNotBlank() }?.let { contextMappings[it] } ?: hostCategories[host]

    /** 인덱스를 읽은 날이 지나면 오늘 청구는 아직 0 이다. */
    fun chargedToday(campaignId: Long, today: LocalDate): Long =
        if (today == chargedDay) chargedToday[campaignId] ?: 0 else 0

    fun chargedTotal(campaignId: Long): Long = chargedTotal[campaignId] ?: 0

    private val paidCampaigns: Map<Long, Campaign> =
        paidByPlacement.values.flatten().associate { it.campaignId to it.campaign }

    /** 인덱스에 유료 후보로 올라 있는 캠페인. 정지·일시정지·승인 취소로 빠졌으면 null. */
    fun paidCampaign(campaignId: Long): Campaign? = paidCampaigns[campaignId]
}

/** 한 지면의 유료 후보 (캠페인, 소재). [aspectRatio] 는 소재 이미지가 맞는 그 지면의 허용 비율. */
data class PaidCandidate(
    val campaign: Campaign,
    val creativeId: Long,
    val content: PaidCreativeContent,
    val aspectRatio: AspectRatio,
    val predictedCtr: Double,
) {
    val campaignId: Long get() = requireNotNull(campaign.id)
    val advertiserId: Long get() = campaign.advertiserId
    val ecpmMicros: Double get() = requireNotNull(campaign.bid).ecpmMicros(predictedCtr)
}

data class HouseCandidate(val campaign: Campaign, val creativeId: Long, val content: HouseCreativeContent)

/** 유료 광고주의 결정용 상태. HOUSE(SYSTEM) 광고주는 지갑이 없어 여기 없다. */
data class AdvertiserAccount(
    val advertiserId: Long,
    val memberId: Long,
    val displayName: String,
    val walletBalanceMicros: Long,
    val settledThroughHour: LocalDateTime?,
) {
    /**
     * 아직 정산되지 않은 시각들 — 정산 완료 시각 다음 시각부터 [hour] 까지. 한 번도 정산되지 않았으면 정산 지연 한도만큼
     * 거슬러 본다. 그보다 오래된 미정산 지출이 있는 광고주는 이미 [WalletHeadroom.StaleSettlement] 로 후보에서 빠진다.
     * 결정(예산 여유)과 이벤트 수락(예산 상한)이 같은 범위를 봐야 한쪽만 통과하는 지출이 생기지 않는다.
     */
    fun unsettledHoursThrough(hour: LocalDateTime): List<LocalDateTime> {
        val oldest = hour.minus(WalletHeadroom.MAX_UNSETTLED)
        val from = settledThroughHour?.plusHours(1)?.let { maxOf(it, oldest) } ?: oldest
        return generateSequence(from) { it.plusHours(1) }.takeWhile { !it.isAfter(hour) }.toList()
    }
}
