package com.kgd.ads.application.event.service

import com.kgd.ads.application.creative.port.CreativeReadPort
import com.kgd.ads.application.decision.dto.CandidateSnapshot
import com.kgd.ads.application.decision.service.CandidateIndexService
import com.kgd.ads.application.event.dto.AcceptanceBatch
import com.kgd.ads.application.event.dto.AcceptanceOutcome
import com.kgd.ads.application.event.dto.BillableEvent
import com.kgd.ads.application.event.dto.CampaignBudget
import com.kgd.ads.application.event.dto.ClickRate
import com.kgd.ads.application.event.port.EventCounterPort
import com.kgd.ads.application.event.port.EventMetricsPort
import com.kgd.ads.application.event.usecase.AcceptAdEventsUseCase
import com.kgd.ads.application.event.usecase.RedirectClickUseCase
import com.kgd.ads.domain.creative.model.CreativeStatus
import com.kgd.ads.domain.placement.model.FillSource
import com.kgd.ads.domain.token.model.EventRejectReason
import com.kgd.ads.domain.token.model.ServeClaims
import com.kgd.ads.domain.token.model.TokenKind
import com.kgd.ads.domain.token.model.TokenVerification
import com.kgd.ads.domain.token.policy.ServeTokenSigner
import com.kgd.ads.domain.token.policy.VisitorHash
import com.kgd.common.web.CrawlerUserAgents
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import java.time.Clock
import java.time.LocalDateTime
import java.time.temporal.ChronoUnit

/**
 * 가시 노출 수락과 클릭 리다이렉트.
 *
 * 토큰마다 서명·수명·방문자·과금 여부를 메모리에서 먼저 보고, 통과한 것만 Redis 로 보낸다. Redis 쪽은 명령 한 번이
 * 일회성 표식 · 클릭 속도 · 캠페인 시간당 상한·일예산·총예산을 확인하고 수락한 것만 카운터에 올린다 —
 * 결정 때는 상한 아래였던 토큰을 모아 한꺼번에 내도 넘친 몫은 `over_budget` 이다.
 *
 * 예산 한도는 후보 인덱스 스냅샷(청구 누계·정산 완료 시각)에서 가져온다. 인덱스에서 빠진 캠페인(정지·일시정지·승인 취소)의
 * 토큰은 과금하지 않는다(`not_billable`). Redis 가 실패하면 아무것도 받지 않는다(`redis_unavailable`).
 */
@Service
class AdEventService(
    private val candidateIndex: CandidateIndexService,
    private val counterPort: EventCounterPort,
    private val metricsPort: EventMetricsPort,
    private val creativeReadPort: CreativeReadPort,
    private val tokenSigner: ServeTokenSigner,
    @Qualifier("adsClock") private val clock: Clock,
    @Value("\${ads.click.max-per-visitor-per-window:5}") private val clickLimitPerWindow: Int,
) : AcceptAdEventsUseCase, RedirectClickUseCase {

    private val log = KotlinLogging.logger {}

    override fun execute(command: AcceptAdEventsUseCase.Command): AcceptAdEventsUseCase.Result {
        val tokens = command.impressionTokens
        if (CrawlerUserAgents.isCrawler(command.userAgent)) {
            tokens.forEach { metricsPort.recordEvent(TokenKind.IMP, EventRejectReason.CRAWLER.code) }
            return AcceptAdEventsUseCase.Result(0, if (tokens.isEmpty()) emptyMap() else mapOf(EventRejectReason.CRAWLER to tokens.size))
        }

        val now = LocalDateTime.now(clock)
        val snapshot = candidateIndex.current()
        val visitorHash = visitorHashOf(command.visitorId)
        val outcomes = arrayOfNulls<EventRejectReason?>(tokens.size)
        val accepted = BooleanArray(tokens.size)
        val candidates = mutableListOf<Pair<Int, ServeClaims>>()
        tokens.forEachIndexed { i, token ->
            when (val verdict = tokenSigner.verify(token, TokenKind.IMP, visitorHash)) {
                is TokenVerification.Rejected -> outcomes[i] = verdict.reason
                is TokenVerification.Accepted -> candidates += i to verdict.claims
            }
        }
        val fills = snapshot?.let { registeredFills(command.fills, it) }.orEmpty()

        val plan = plan(candidates, snapshot, now)
        plan.notBillable.forEach { outcomes[it] = EventRejectReason.NOT_BILLABLE }

        if (plan.events.isNotEmpty() || fills.isNotEmpty()) {
            val results = counterPort.accept(AcceptanceBatch(hourOf(now), plan.budgets, plan.events.map { it.second }, fills, null))
            if (results == null) {
                log.warn { "ads 이벤트 수락 Redis 실패 — 이번 요청은 받지 않는다: tokens=${plan.events.size}" }
                plan.events.forEach { (i, _) -> outcomes[i] = EventRejectReason.REDIS_UNAVAILABLE }
            } else {
                plan.events.zip(results).forEach { (event, outcome) ->
                    val reason = reasonOf(outcome)
                    if (reason == null) accepted[event.first] = true else outcomes[event.first] = reason
                }
            }
        }

        tokens.indices.forEach { i -> metricsPort.recordEvent(TokenKind.IMP, outcomes[i]?.code ?: OUTCOME_ACCEPTED) }
        val rejected = outcomes.filterNotNull().groupingBy { it }.eachCount()
        log.debug {
            "광고 이벤트 수락: accepted=${accepted.count { it }} rejected=${rejected.mapKeys { it.key.code }} " +
                "decisions=${candidates.map { it.second.ad.decisionId }.distinct()} fills=${fills.size}"
        }
        return AcceptAdEventsUseCase.Result(accepted.count { it }, rejected)
    }

    override fun execute(command: RedirectClickUseCase.Command): String {
        val visitorHash = visitorHashOf(command.visitorId)
        val verdict = tokenSigner.verify(command.clickToken, TokenKind.CLK, visitorHash)
        val claims = when (verdict) {
            is TokenVerification.Accepted -> verdict.claims
            is TokenVerification.Rejected -> verdict.claims
        }
        // 서명이 틀린 토큰은 어떤 값도 믿지 않는다 — 소재 id 로 DB 를 찾지도 않는다.
        if (claims == null) {
            metricsPort.recordEvent(TokenKind.CLK, EventRejectReason.INVALID_SIGNATURE.code)
            return home()
        }
        val landing = runCatching { creativeReadPort.findLanding(claims.ad.creativeId) }
            .onFailure { log.warn(it) { "광고 클릭 랜딩 조회 실패 — 홈으로 보낸다: decisionId=${claims.ad.decisionId}" } }
            .getOrNull()
        val landingUrl = landing?.takeIf { it.status == CreativeStatus.APPROVED }?.landingUrl?.value
        if (landingUrl == null) {
            metricsPort.recordEvent(TokenKind.CLK, EventRejectReason.NOT_BILLABLE.code)
            return home()
        }

        // 기록은 보낼 곳을 막지 않는다 — 어떤 실패도 랜딩으로 보내는 것을 바꾸지 않는다.
        val outcome = runCatching { billClick(verdict, claims, visitorHash, command.userAgent) }
            .onFailure { log.warn(it) { "광고 클릭 기록 실패 — 랜딩으로는 보낸다: decisionId=${claims.ad.decisionId}" } }
            .getOrDefault(EventRejectReason.REDIS_UNAVAILABLE.code)
        metricsPort.recordEvent(TokenKind.CLK, outcome)
        metricsPort.recordClickDestination(DESTINATION_LANDING)
        log.debug { "광고 클릭: decisionId=${claims.ad.decisionId} creative=${claims.ad.creativeId} outcome=$outcome" }
        return landingUrl
    }

    /** @return `accepted` 또는 과금하지 않은 사유 코드 */
    private fun billClick(verdict: TokenVerification, claims: ServeClaims, visitorHash: String, userAgent: String?): String {
        if (verdict is TokenVerification.Rejected) return verdict.reason.code
        if (CrawlerUserAgents.isCrawler(userAgent)) return EventRejectReason.CRAWLER.code

        val now = LocalDateTime.now(clock)
        val rate = ClickRate(visitorHash, clickWindowOf(now), clickLimitPerWindow)
        val plan = plan(listOf(0 to claims), candidateIndex.current(), now)
        if (plan.events.isEmpty()) return EventRejectReason.NOT_BILLABLE.code

        val results = counterPort.accept(AcceptanceBatch(hourOf(now), plan.budgets, plan.events.map { it.second }, emptyMap(), rate))
            ?: return EventRejectReason.REDIS_UNAVAILABLE.code
        return reasonOf(results.single())?.code ?: OUTCOME_ACCEPTED
    }

    private class Plan(
        val events: List<Pair<Int, BillableEvent>>,
        val budgets: Map<Long, CampaignBudget>,
        val notBillable: List<Int>,
    )

    /** 인덱스에 캠페인과 광고주 계정이 있는 이벤트만 예산 한도와 함께 Redis 로 보낸다. */
    private fun plan(candidates: List<Pair<Int, ServeClaims>>, snapshot: CandidateSnapshot?, now: LocalDateTime): Plan {
        val hour = hourOf(now)
        val events = mutableListOf<Pair<Int, BillableEvent>>()
        val budgets = mutableMapOf<Long, CampaignBudget>()
        val notBillable = mutableListOf<Int>()
        candidates.forEach { (i, claims) ->
            val ad = claims.ad
            val budget = snapshot?.let { budgets[ad.campaignId] ?: budgetOf(it, ad.campaignId, ad.advertiserId, now, hour) }
            if (budget == null) {
                notBillable += i
                return@forEach
            }
            budgets[ad.campaignId] = budget
            events += i to BillableEvent(claims.kind, ad, ad.chargeFor(claims.kind))
        }
        return Plan(events, budgets, notBillable)
    }

    private fun budgetOf(snapshot: CandidateSnapshot, campaignId: Long, advertiserId: Long, now: LocalDateTime, hour: LocalDateTime): CampaignBudget? {
        val campaign = snapshot.paidCampaign(campaignId)?.takeIf { it.advertiserId == advertiserId } ?: return null
        val account = snapshot.accounts[advertiserId] ?: return null
        val today = now.toLocalDate()
        val (todayHours, earlierHours) = account.unsettledHoursThrough(hour).filter { it != hour }.partition { it.toLocalDate() == today }
        return CampaignBudget(
            dailyRemainingMicros = requireNotNull(campaign.dailyBudgetMicros) - snapshot.chargedToday(campaignId, today),
            totalRemainingMicros = campaign.totalBudgetMicros?.let { it - snapshot.chargedTotal(campaignId) },
            hourlyCapMicros = requireNotNull(campaign.hourlyCapMicros),
            unsettledHoursToday = todayHours,
            unsettledHoursEarlier = earlierHours,
        )
    }

    /** 등록된 지면의 허용 값만, 지면마다 첫 보고 하나만 센다. */
    private fun registeredFills(reports: List<AcceptAdEventsUseCase.FillReport>, snapshot: CandidateSnapshot): Map<String, FillSource> =
        reports.filter { it.placementKey in snapshot.placements }
            .mapNotNull { report -> FillSource.parse(report.source)?.let { report.placementKey to it } }
            .distinctBy { it.first }
            .toMap()

    private fun reasonOf(outcome: AcceptanceOutcome): EventRejectReason? = when (outcome) {
        AcceptanceOutcome.ACCEPTED -> null
        AcceptanceOutcome.DUPLICATE -> EventRejectReason.DUPLICATE
        AcceptanceOutcome.OVER_BUDGET -> EventRejectReason.OVER_BUDGET
        AcceptanceOutcome.RATE_LIMITED -> EventRejectReason.RATE_LIMITED
    }

    // 방문자 헤더가 없으면 빈 문자열의 해시와 비교한다 — 토큰의 방문자 해시와 맞을 수 없어 visitor_mismatch 가 된다.
    private fun visitorHashOf(visitorId: String?): String = VisitorHash.of(visitorId.orEmpty())

    private fun hourOf(now: LocalDateTime): LocalDateTime = now.truncatedTo(ChronoUnit.HOURS)

    private fun clickWindowOf(now: LocalDateTime): LocalDateTime =
        now.truncatedTo(ChronoUnit.HOURS).plusMinutes(now.minute / CLICK_WINDOW_MINUTES * CLICK_WINDOW_MINUTES)

    private fun home(): String {
        metricsPort.recordClickDestination(DESTINATION_HOME)
        return HOME
    }

    companion object {
        /** 클릭 속도 제한의 창(분). 고정 창이라 창 경계에서 최대 두 배까지 과금될 수 있다 — 손실 상한은 시간당 상한이 따로 막는다. */
        const val CLICK_WINDOW_MINUTES = 10L
        const val HOME = "/"
        private const val OUTCOME_ACCEPTED = "accepted"
        private const val DESTINATION_LANDING = "landing"
        private const val DESTINATION_HOME = "home"
    }
}
