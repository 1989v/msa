package com.kgd.ads.application.settlement.service

import com.kgd.ads.application.settlement.port.HourCounterPort
import com.kgd.ads.application.settlement.port.HourlyStatsPort
import com.kgd.ads.application.settlement.port.SettlementMetricsPort
import com.kgd.ads.application.settlement.port.SettlementPort
import com.kgd.ads.application.settlement.usecase.RunSettlementUseCase
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Service
import java.time.Clock
import java.time.Duration
import java.time.LocalDateTime
import java.time.temporal.ChronoUnit

/**
 * 카운터 → 시간별 집계 → 정산 한 바퀴. 트랜잭션은 시각 하나·(캠페인, 시각) 하나 단위로 짧게 연다 —
 * Redis 읽기는 트랜잭션 밖, 한 단위의 실패가 다른 단위를 막지 않는다.
 *
 * 1. 카운터 수명 창 안에서 아직 닫히지 않은 시각 **전부**를 절대값으로 덮어쓴다. 작업이 몇 시간 멈췄어도
 *    다음 실행이 창 안의 시각을 모두 따라잡는다. 창보다 오래된 미닫힘 행(카운터는 이미 만료)은 있는 값으로 닫는다.
 * 2. 시각 끝 + [CLOSE_GRACE] 가 지난 시각은 그 덮어쓰기와 같은 트랜잭션에서 닫는다 — 덮어쓰기가 실패하면 닫히지 않는다.
 *    카운터 키는 수락 시각을 앱이 읽은 순간으로 정하므로, 경계 직전에 시각을 읽은 요청이 경계 뒤에 앞 시각 키를
 *    올릴 수 있다. 유예가 그 몫을 덮는다.
 * 3. 닫혔고 정산 안 된 (캠페인, 시각) 전부를 정산하고, 광고주별 「정산 완료 시각」을 옮긴다.
 */
@Service
class SettlementService(
    private val hourCounterPort: HourCounterPort,
    private val hourlyStatsPort: HourlyStatsPort,
    private val settlementPort: SettlementPort,
    private val settlementTransactionalService: SettlementTransactionalService,
    private val metrics: SettlementMetricsPort,
    @Qualifier("adsClock") private val clock: Clock,
) : RunSettlementUseCase {

    private val log = KotlinLogging.logger {}

    override fun run(): RunSettlementUseCase.Result {
        val now = LocalDateTime.now(clock)
        val currentHour = now.truncatedTo(ChronoUnit.HOURS)
        val windowStart = currentHour.minusHours(COUNTER_WINDOW_HOURS - 1)
        val lastCloseable = now.minus(CLOSE_GRACE).minusHours(1).truncatedTo(ChronoUnit.HOURS)

        val aggregated = mutableListOf<LocalDateTime>()
        val failed = mutableListOf<LocalDateTime>()
        val closed = mutableListOf<LocalDateTime>()
        val alreadyClosed = hourlyStatsPort.closedHours(windowStart, currentHour)
        val openHours = (hoursBetween(windowStart, currentHour).filterNot { it in alreadyClosed } +
            hourlyStatsPort.unclosedHoursBefore(windowStart)).distinct().sorted()
        val placementKeys = hourlyStatsPort.registeredPlacementKeys()
        for (hour in openHours) {
            val closeAt = now.takeIf { !hour.isAfter(lastCloseable) }
            try {
                hourlyStatsPort.save(hour, hourCounterPort.read(hour, placementKeys), closeAt, now)
                aggregated += hour
                if (closeAt != null) closed += hour
            } catch (e: RuntimeException) {
                log.error(e) { "광고 시간별 집계 실패 — 이 시각은 닫지 않고 다음 실행에서 다시 한다: hour=$hour" }
                failed += hour
            }
        }
        if (failed.isEmpty()) metrics.recordAggregated(now)

        var settled = 0
        var settlementFailures = 0
        for (item in settlementPort.findUnsettled()) {
            try {
                settlementTransactionalService.settle(item, now)
                settled++
            } catch (e: RuntimeException) {
                log.error(e) { "광고 정산 실패 — 다음 실행에서 다시 한다: campaignId=${item.campaignId} hour=${item.hourKst}" }
                settlementFailures++
            }
        }

        val closedThrough = closedThrough(windowStart, lastCloseable)
        // 정산이 실패한 시각이 남은 광고주는 그 시각 전까지만 정산 완료다
        val overrides = settlementPort.findUnsettled()
            .groupBy { it.advertiserId }
            .mapValues { (_, items) -> minOf(items.minOf { it.hourKst }.minusHours(1), closedThrough) }
        settlementPort.updateSettledThrough(closedThrough, overrides, now)
        if (settlementFailures == 0) metrics.recordSettled(now)

        log.info {
            "광고 집계·정산: aggregated=${aggregated.size} failed=${failed.size} closed=${closed.size} " +
                "settled=$settled settlementFailures=$settlementFailures closedThrough=$closedThrough"
        }
        return RunSettlementUseCase.Result(aggregated, failed, closed, settled, settlementFailures, closedThrough)
    }

    /** 창 시작부터 빈틈없이 닫힌 마지막 시각. 창 밖은 카운터가 없어 더 늘어날 지출이 없다. */
    private fun closedThrough(windowStart: LocalDateTime, lastCloseable: LocalDateTime): LocalDateTime {
        val closedHours = hourlyStatsPort.closedHours(windowStart, lastCloseable)
        val firstOpen = hoursBetween(windowStart, lastCloseable).firstOrNull { it !in closedHours }
            ?: return lastCloseable
        return firstOpen.minusHours(1)
    }

    private fun hoursBetween(from: LocalDateTime, to: LocalDateTime): List<LocalDateTime> =
        generateSequence(from) { it.plusHours(1) }.takeWhile { !it.isAfter(to) }.toList()

    companion object {
        /** 카운터 수명(48시간)과 같은 창 — 그보다 오래된 시각은 Redis 에 읽을 것이 없다. */
        const val COUNTER_WINDOW_HOURS = 48L

        val CLOSE_GRACE: Duration = Duration.ofMinutes(10)
    }
}
