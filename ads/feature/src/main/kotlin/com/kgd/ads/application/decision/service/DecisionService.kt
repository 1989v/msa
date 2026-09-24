package com.kgd.ads.application.decision.service

import com.kgd.ads.application.decision.dto.CandidateSnapshot
import com.kgd.ads.application.decision.dto.CounterQuery
import com.kgd.ads.application.decision.dto.DecisionCounters
import com.kgd.ads.application.decision.dto.PaidCandidate
import com.kgd.ads.application.decision.dto.ServeTally
import com.kgd.ads.application.decision.port.DecisionCounterPort
import com.kgd.ads.application.decision.port.DecisionMetricsPort
import com.kgd.ads.application.decision.usecase.DecideAdsUseCase
import com.kgd.ads.application.decision.usecase.DecideAdsUseCase.HouseCreativeView
import com.kgd.ads.application.decision.usecase.DecideAdsUseCase.NoAdReason
import com.kgd.ads.application.decision.usecase.DecideAdsUseCase.PlacementDecision
import com.kgd.ads.application.decision.usecase.DecideAdsUseCase.ServedAdView
import com.kgd.ads.domain.decision.policy.Auction
import com.kgd.ads.domain.decision.policy.AuctionCandidate
import com.kgd.ads.domain.decision.policy.Pacing
import com.kgd.ads.domain.decision.policy.WalletHeadroom
import com.kgd.ads.domain.token.model.ServedAd
import com.kgd.ads.domain.token.model.TokenKind
import com.kgd.ads.domain.token.policy.ServeTokenSigner
import com.kgd.ads.domain.token.policy.VisitorHash
import com.kgd.common.web.CrawlerUserAgents
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Service
import java.time.Clock
import java.time.Duration
import java.time.LocalDateTime
import java.time.temporal.ChronoUnit
import java.util.UUID
import kotlin.random.Random

/**
 * 광고 결정. 순서가 곧 비용 구조다.
 *
 * 1. 크롤러는 여기서 끝낸다 — ads Redis 를 한 번도 부르지 않는다
 * 2. 메모리 인덱스로 요청마다 달라지는 자격(기간·카테고리·정산 지연·청구 기준 예산)을 거른다
 * 3. 남은 후보 중 eCPM 상위 [MAX_REDIS_CANDIDATES] 캠페인만 Redis 에서 **한 번에** 읽는다
 *    (방문자 빈도 · 캠페인 시각별 지출 · 광고주 시각별 지출). 실패하면 유료 광고 없음(`redis_unavailable`)
 * 4. 빈도·예산·시간당 상한·지갑 여유·페이싱을 통과한 후보로 경매한다
 * 5. 낙찰마다 노출·클릭 토큰 — 요청 회원이 캠페인 소유자면 과금하지 않는 토큰
 * 6. 지면 요청·유료 채움·미등록 지면 카운터를 **한 번의 쓰기 명령**으로 올린다. 실패는 경고만
 *
 * 예산 여유는 「청구 누계(인덱스) + 정산 완료 시각 뒤 지출(Redis)」로 본다. 정산된 시각의 지출은
 * 청구 누계에 이미 들어 있어 두 번 세지 않는다.
 */
@Service
class DecisionService(
    private val candidateIndex: CandidateIndexService,
    private val counterPort: DecisionCounterPort,
    private val metricsPort: DecisionMetricsPort,
    private val tokenSigner: ServeTokenSigner,
    @Qualifier("adsClock") private val clock: Clock,
    @Qualifier("adsRandom") private val random: Random,
) : DecideAdsUseCase {

    private val log = KotlinLogging.logger {}
    private val pacing = Pacing(clock)

    override fun execute(command: DecideAdsUseCase.Command): DecideAdsUseCase.Result {
        val startedNanos = System.nanoTime()
        val decisionId = UUID.randomUUID().toString()
        val keys = command.placementKeys.distinct()
        val snapshot = candidateIndex.current()

        val placements = when {
            snapshot == null -> keys.map { none(it, NoAdReason.NO_CANDIDATES) }.also {
                log.warn { "광고 후보 인덱스가 아직 없음: decisionId=$decisionId" }
            }
            CrawlerUserAgents.isCrawler(command.userAgent) -> keys.map { key ->
                // 크롤러에게도 사람과 같은 HOUSE 를 보인다(화면을 달리 내지 않는다). 유료·토큰·카운터는 없다.
                none(key, if (key in snapshot.placements) NoAdReason.NO_CANDIDATES else NoAdReason.UNREGISTERED_PLACEMENT, houseOf(snapshot, key, command))
            }.also { list -> list.forEach { metricsPort.recordOutcome(tagOf(snapshot, it.placementKey), OUTCOME_CRAWLER) } }
            else -> decide(decisionId, keys, snapshot, command)
        }

        metricsPort.recordLatency(Duration.ofNanos(System.nanoTime() - startedNanos))
        return DecideAdsUseCase.Result(decisionId, placements)
    }

    private fun decide(
        decisionId: String,
        keys: List<String>,
        snapshot: CandidateSnapshot,
        command: DecideAdsUseCase.Command,
    ): List<PlacementDecision> {
        val now = LocalDateTime.now(clock)
        val hour = now.truncatedTo(ChronoUnit.HOURS)
        val registered = keys.mapNotNull { snapshot.placements[it] }
        val category = snapshot.categoryOf(command.host, command.contextKey)
        val visitorHash = command.visitorId?.takeIf { it.isNotBlank() }?.let(VisitorHash::of)

        // 요청 시각·문맥만으로 거를 수 있는 것 — Redis 전에
        val memoryEligible: Map<String, List<PaidCandidate>> = if (visitorHash == null) {
            emptyMap()
        } else {
            registered.associate { placement ->
                placement.key to snapshot.paidByPlacement[placement.key].orEmpty().filter { isMemoryEligible(it, snapshot, now, category) }
            }
        }
        val topCampaigns = memoryEligible.values.flatten()
            .sortedWith(compareByDescending<PaidCandidate> { it.ecpmMicros }.thenBy { it.campaignId })
            .map { it.campaignId }
            .distinct()
            .take(MAX_REDIS_CANDIDATES)
            .toSet()

        var redisUnavailable = false
        val counters: DecisionCounters = if (topCampaigns.isEmpty() || visitorHash == null) {
            DecisionCounters.NONE
        } else {
            counterPort.read(counterQuery(visitorHash, topCampaigns, memoryEligible, snapshot, now, hour)) ?: run {
                redisUnavailable = true
                log.warn { "광고 결정 Redis 읽기 실패 — 유료 광고 없음: decisionId=$decisionId" }
                DecisionCounters.NONE
            }
        }

        val auctionInput: Map<String, List<AuctionCandidate>> = if (redisUnavailable) {
            emptyMap()
        } else {
            memoryEligible.mapValues { (_, list) ->
                list.filter { it.campaignId in topCampaigns && isRealtimeEligible(it, snapshot, counters, now, hour) }
                    .map { AuctionCandidate(it.campaignId, it.creativeId, it.advertiserId, requireNotNull(it.campaign.bid), it.aspectRatio, it.predictedCtr) }
            }
        }
        val winners = Auction.run(registered, auctionInput).associate { it.placementKey to it.winner }
        val candidatesById = memoryEligible.values.flatten().associateBy { it.campaignId to it.creativeId }

        val decisions = keys.map { key ->
            val placement = snapshot.placements[key]
            val winner = winners[key]
            when {
                placement == null -> none(key, NoAdReason.UNREGISTERED_PLACEMENT)
                winner != null -> PlacementDecision(
                    placementKey = key,
                    ad = serve(decisionId, key, candidatesById.getValue(winner.campaignId to winner.creativeId), snapshot, command.memberId, requireNotNull(visitorHash)),
                    noAdReason = null,
                    house = houseOf(snapshot, key, command),
                )
                redisUnavailable && memoryEligible[key].orEmpty().isNotEmpty() ->
                    none(key, NoAdReason.REDIS_UNAVAILABLE, houseOf(snapshot, key, command))
                else -> none(key, NoAdReason.NO_CANDIDATES, houseOf(snapshot, key, command))
            }
        }

        // Redis 가 방금 응답하지 않았으면 쓰기는 건너뛴다 — 같은 타임아웃을 한 번 더 기다리지 않게
        if (!redisUnavailable) record(decisionId, hour, decisions, snapshot)
        decisions.forEach { metricsPort.recordOutcome(tagOf(snapshot, it.placementKey), it.noAdReason?.code ?: OUTCOME_AD) }
        log.debug {
            "광고 결정: decisionId=$decisionId visitor=${visitorHash ?: "-"} " +
                decisions.joinToString(" ") { "${it.placementKey}=${it.ad?.campaignId ?: it.noAdReason?.code}" }
        }
        return decisions
    }

    private fun isMemoryEligible(candidate: PaidCandidate, snapshot: CandidateSnapshot, now: LocalDateTime, category: String?): Boolean {
        val campaign = candidate.campaign
        val account = snapshot.accounts[candidate.advertiserId] ?: return false
        if (!campaign.isRunningAt(now) || !campaign.matchesCategory(category)) return false
        // 정산이 6시간 넘게 멈춘 광고주는 Redis 를 읽기 전에 뺀다(지출과 무관하게 판정된다)
        if (WalletHeadroom.of(account.walletBalanceMicros, account.settledThroughHour, emptyMap(), now) is WalletHeadroom.StaleSettlement) {
            return false
        }
        return campaign.hasBudgetFor(snapshot.chargedToday(candidate.campaignId, now.toLocalDate()), snapshot.chargedTotal(candidate.campaignId))
    }

    private fun isRealtimeEligible(
        candidate: PaidCandidate,
        snapshot: CandidateSnapshot,
        counters: DecisionCounters,
        now: LocalDateTime,
        hour: LocalDateTime,
    ): Boolean {
        val campaign = candidate.campaign
        val account = snapshot.accounts.getValue(candidate.advertiserId)
        if (!campaign.isUnderFrequencyCap(counters.viewsToday(candidate.campaignId))) return false

        val unsettled = counters.campaignSpendByHour(candidate.campaignId)
        val spentToday = snapshot.chargedToday(candidate.campaignId, now.toLocalDate()) +
            unsettled.filterKeys { it.toLocalDate() == now.toLocalDate() }.values.sum()
        val spentTotal = snapshot.chargedTotal(candidate.campaignId) + unsettled.values.sum()
        if (!campaign.hasBudgetFor(spentToday, spentTotal)) return false
        if (!campaign.isUnderHourlyCap(unsettled[hour] ?: 0)) return false

        val headroom = WalletHeadroom.of(account.walletBalanceMicros, account.settledThroughHour, counters.advertiserSpendByHour(account.advertiserId), now)
        val charge = requireNotNull(campaign.bid).chargeMicros
        if (headroom !is WalletHeadroom.Available || !headroom.canAfford(charge)) return false

        return pacing.passes(spentToday, requireNotNull(campaign.dailyBudgetMicros), random)
    }

    private fun counterQuery(
        visitorHash: String,
        campaignIds: Set<Long>,
        memoryEligible: Map<String, List<PaidCandidate>>,
        snapshot: CandidateSnapshot,
        now: LocalDateTime,
        hour: LocalDateTime,
    ): CounterQuery {
        val advertiserOf = memoryEligible.values.flatten().filter { it.campaignId in campaignIds }.associate { it.campaignId to it.advertiserId }
        val hoursOf = advertiserOf.values.toSet().associateWith { snapshot.accounts.getValue(it).unsettledHoursThrough(hour) }
        return CounterQuery(
            visitorHash = visitorHash,
            day = now.toLocalDate(),
            campaignIds = campaignIds,
            campaignHours = advertiserOf.mapValues { (_, advertiserId) -> hoursOf.getValue(advertiserId) },
            advertiserHours = hoursOf,
        )
    }

    private fun serve(
        decisionId: String,
        placementKey: String,
        candidate: PaidCandidate,
        snapshot: CandidateSnapshot,
        memberId: Long?,
        visitorHash: String,
    ): ServedAdView {
        val account = snapshot.accounts.getValue(candidate.advertiserId)
        val bid = requireNotNull(candidate.campaign.bid)
        // 광고주 본인이 보는 광고는 보이되 과금하지 않는다. 이벤트 단계는 신원을 보지 않고 이 값만 믿는다.
        val served = ServedAd(
            decisionId = decisionId,
            campaignId = candidate.campaignId,
            creativeId = candidate.creativeId,
            advertiserId = candidate.advertiserId,
            placementKey = placementKey,
            bidType = bid.type,
            chargeMicros = bid.chargeMicros,
            billable = memberId != account.memberId,
            visitorHash = visitorHash,
        )
        return ServedAdView(
            campaignId = candidate.campaignId,
            creativeId = candidate.creativeId,
            title = candidate.content.title,
            body = candidate.content.body,
            imageHash = candidate.content.imageHash,
            advertiserName = account.displayName,
            impressionToken = tokenSigner.issue(TokenKind.IMP, served),
            clickToken = tokenSigner.issue(TokenKind.CLK, served),
        )
    }

    private fun record(decisionId: String, hour: LocalDateTime, decisions: List<PlacementDecision>, snapshot: CandidateSnapshot) {
        val (known, unknown) = decisions.partition { it.placementKey in snapshot.placements }
        val tally = ServeTally(
            hour = hour,
            requests = known.associate { it.placementKey to 1L },
            paidFilled = known.filter { it.ad != null }.associate { it.placementKey to 1L },
            // 요청이 정하는 값이라 형식이 맞는 키만 센다 — 아무 문자열이나 Redis 필드가 되지 않게
            unregistered = unknown.map { it.placementKey }.filter { it.length <= MAX_PLACEMENT_KEY_LENGTH && UNREGISTERED_KEY.matches(it) }.associateWith { 1L },
        )
        if (!counterPort.record(tally)) log.warn { "광고 결정 카운터 기록 실패: decisionId=$decisionId" }
    }

    private fun houseOf(snapshot: CandidateSnapshot, key: String, command: DecideAdsUseCase.Command): List<HouseCreativeView> {
        val now = LocalDateTime.now(clock)
        val category = snapshot.categoryOf(command.host, command.contextKey)
        return snapshot.houseByPlacement[key].orEmpty()
            .filter { it.campaign.isRunningAt(now) && it.campaign.matchesCategory(category) }
            .map {
                HouseCreativeView(
                    creativeId = it.creativeId,
                    title = it.content.title,
                    body = it.content.body,
                    emoji = it.content.emoji,
                    link = it.content.link.value,
                    imageHash = it.content.imageHash,
                )
            }
    }

    private fun none(key: String, reason: NoAdReason, house: List<HouseCreativeView> = emptyList()) =
        PlacementDecision(placementKey = key, ad = null, noAdReason = reason, house = house)

    private fun tagOf(snapshot: CandidateSnapshot, key: String): String =
        if (key in snapshot.placements) key else UNREGISTERED_TAG

    companion object {
        /** Redis 에 묻는 캠페인 수 상한 — 읽기 한 번의 크기를 요청 내용과 무관하게 묶는다. */
        const val MAX_REDIS_CANDIDATES = 20
        private const val OUTCOME_AD = "ad"
        private const val OUTCOME_CRAWLER = "crawler"
        private const val UNREGISTERED_TAG = "unregistered"
        private const val MAX_PLACEMENT_KEY_LENGTH = 64
        private val UNREGISTERED_KEY = Regex("^[a-z0-9]+(-[a-z0-9]+)*$")
    }
}
