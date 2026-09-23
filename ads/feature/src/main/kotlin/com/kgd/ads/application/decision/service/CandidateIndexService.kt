package com.kgd.ads.application.decision.service

import com.kgd.ads.application.decision.dto.AdvertiserAccount
import com.kgd.ads.application.decision.dto.CandidateSnapshot
import com.kgd.ads.application.decision.dto.CandidateSource
import com.kgd.ads.application.decision.dto.HouseCandidate
import com.kgd.ads.application.decision.dto.PaidCandidate
import com.kgd.ads.application.decision.port.CandidateSourcePort
import com.kgd.ads.application.decision.port.DecisionMetricsPort
import com.kgd.ads.application.decision.usecase.RefreshCandidateIndexUseCase
import com.kgd.ads.domain.advertiser.model.AdvertiserKind
import com.kgd.ads.domain.advertiser.model.AdvertiserStatus
import com.kgd.ads.domain.campaign.model.CampaignPriority
import com.kgd.ads.domain.campaign.model.CampaignStatus
import com.kgd.ads.domain.creative.model.HouseCreativeContent
import com.kgd.ads.domain.creative.model.PaidCreativeContent
import com.kgd.ads.domain.decision.policy.PredictedCtr
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Service
import java.time.Clock
import java.time.LocalDateTime
import java.util.concurrent.atomic.AtomicReference

/**
 * 후보 인덱스 — 파드 메모리에 한 벌을 두고 갱신 때 통째로 바꾼다.
 *
 * 결정 경로가 DB 를 읽지 않는 대가로 승인·정지·반려·매핑 변경은 다음 갱신(1분 안)에 반영된다.
 * 갱신이 실패하면 이전 인덱스를 그대로 쓴다 — 빈 인덱스로 바꾸면 모든 지면이 미등록으로 집계된다.
 */
@Service
class CandidateIndexService(
    private val candidateSourcePort: CandidateSourcePort,
    private val metricsPort: DecisionMetricsPort,
    @Qualifier("adsClock") private val clock: Clock,
) : RefreshCandidateIndexUseCase {

    private val log = KotlinLogging.logger {}
    private val current = AtomicReference<CandidateSnapshot?>(null)

    /** 아직 한 번도 읽지 못했으면 null. */
    fun current(): CandidateSnapshot? = current.get()

    override fun refresh() {
        val now = LocalDateTime.now(clock)
        val snapshot = build(candidateSourcePort.load(now.toLocalDate().atStartOfDay()), now)
        current.set(snapshot)
        metricsPort.recordIndexRefreshed(now)
        log.debug {
            "광고 후보 인덱스 갱신: placements=${snapshot.placements.size} " +
                "paid=${snapshot.paidByPlacement.values.sumOf { it.size }} house=${snapshot.houseByPlacement.values.sumOf { it.size }}"
        }
    }

    private fun build(source: CandidateSource, now: LocalDateTime): CandidateSnapshot {
        val placements = source.placements.filter { it.active }.associateBy { it.key }
        val activeAdvertisers = source.advertisers.filter { it.status == AdvertiserStatus.ACTIVE }.associateBy { requireNotNull(it.id) }
        val campaigns = source.campaigns
            .filter { it.status == CampaignStatus.ACTIVE && it.advertiserId in activeAdvertisers }
            .associateBy { requireNotNull(it.id) }
        val ctr = source.deliveries.associate { (it.creativeId to it.placementKey) to PredictedCtr.of(it.clicks, it.viewableImpressions) }

        val paid = mutableMapOf<String, MutableList<PaidCandidate>>()
        val house = mutableMapOf<String, MutableList<HouseCandidate>>()
        source.creatives.filter { it.isServable }.forEach { creative ->
            val campaign = campaigns[creative.campaignId] ?: return@forEach
            val creativeId = requireNotNull(creative.id)
            campaign.placementKeys.mapNotNull { placements[it] }.forEach { placement ->
                when (val content = creative.content) {
                    is HouseCreativeContent -> if (campaign.priority == CampaignPriority.HOUSE) {
                        house.getOrPut(placement.key) { mutableListOf() } += HouseCandidate(campaign, creativeId, content)
                    }
                    is PaidCreativeContent -> {
                        if (campaign.priority != CampaignPriority.PAID || !placement.paidAllowed) return@forEach
                        val size = source.imageSizes[content.imageHash] ?: return@forEach
                        val ratio = placement.aspectRatios.firstOrNull { it.fits(size.width, size.height) } ?: return@forEach
                        val candidate = PaidCandidate(
                            campaign = campaign,
                            creativeId = creativeId,
                            content = content,
                            aspectRatio = ratio,
                            predictedCtr = ctr[creativeId to placement.key] ?: PredictedCtr.of(0, 0),
                        )
                        if (candidate.ecpmMicros >= placement.floorMicros) {
                            paid.getOrPut(placement.key) { mutableListOf() } += candidate
                        }
                    }
                }
            }
        }

        val accounts = activeAdvertisers.values
            .filter { it.kind == AdvertiserKind.MEMBER }
            .associate { advertiser ->
                val id = requireNotNull(advertiser.id)
                id to AdvertiserAccount(
                    advertiserId = id,
                    memberId = requireNotNull(advertiser.memberId),
                    displayName = advertiser.displayName,
                    walletBalanceMicros = source.walletBalances[id] ?: 0,
                    settledThroughHour = source.settledThrough[id],
                )
            }

        return CandidateSnapshot(
            loadedAt = now,
            placements = placements,
            contextMappings = source.contextMappings,
            hostCategories = source.hostCategories,
            paidByPlacement = paid.mapValues { (_, list) ->
                list.sortedWith(compareByDescending<PaidCandidate> { it.ecpmMicros }.thenBy { it.campaignId }.thenBy { it.creativeId })
            },
            houseByPlacement = house.mapValues { (_, list) -> list.sortedBy { it.creativeId } },
            accounts = accounts,
            chargedDay = now.toLocalDate(),
            chargedToday = source.chargedToday,
            chargedTotal = source.chargedTotal,
        )
    }
}
