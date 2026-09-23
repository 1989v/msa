package com.kgd.ads.application.decision.dto

import com.kgd.ads.domain.advertiser.model.Advertiser
import com.kgd.ads.domain.campaign.model.Campaign
import com.kgd.ads.domain.creative.model.Creative
import com.kgd.ads.domain.placement.model.AdPlacement
import java.time.LocalDateTime

/**
 * 후보 인덱스의 원료 — DB 에서 한 번에(한 읽기 트랜잭션에서) 읽은 값.
 * 잔액·정산 완료 시각·청구 누계가 같은 시점의 값이어야 지갑 여유를 두 번 빼거나 빠뜨리지 않는다.
 *
 * @param campaigns ACTIVE 캠페인만
 * @param creatives 그 캠페인들의 APPROVED 소재만
 * @param imageSizes 소재 이미지 해시 → 가로·세로
 * @param walletBalances 광고주 id → 지갑 잔액
 * @param settledThrough 광고주 id → 정산 완료 시각(그 시각의 시작)
 * @param chargedToday 캠페인 id → 오늘(KST) 청구 누계
 * @param chargedTotal 캠페인 id → 전체 청구 누계
 */
data class CandidateSource(
    val placements: List<AdPlacement>,
    val contextMappings: Map<String, String>,
    val hostCategories: Map<String, String>,
    val advertisers: List<Advertiser>,
    val campaigns: List<Campaign>,
    val creatives: List<Creative>,
    val imageSizes: Map<String, ImageSize>,
    val walletBalances: Map<Long, Long>,
    val settledThrough: Map<Long, LocalDateTime>,
    val chargedToday: Map<Long, Long>,
    val chargedTotal: Map<Long, Long>,
    val deliveries: List<CreativeDelivery>,
)

data class ImageSize(val width: Int, val height: Int)

/** 소재×지면 가시 노출·클릭 합 — 예상 클릭률의 입력. */
data class CreativeDelivery(val creativeId: Long, val placementKey: String, val viewableImpressions: Long, val clicks: Long)
