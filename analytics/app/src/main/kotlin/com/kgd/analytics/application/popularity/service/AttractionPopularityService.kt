package com.kgd.analytics.application.popularity.service

import com.kgd.analytics.application.popularity.port.AttractionPopularityPort
import com.kgd.analytics.application.popularity.usecase.AggregateAttractionPopularityUseCase
import com.kgd.analytics.application.popularity.usecase.AggregateAttractionPopularityUseCase.Companion.MAX_REAGGREGATE_DAYS
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Service
import java.time.Clock
import java.time.LocalDate
import java.time.ZoneId

@Service
class AttractionPopularityService(
    private val port: AttractionPopularityPort,
    private val clock: Clock = Clock.systemUTC(),
) : AggregateAttractionPopularityUseCase {
    private val log = KotlinLogging.logger {}

    override fun aggregate(day: LocalDate): Int = port.aggregateInto(day)

    override fun reaggregateRecent(days: Int): Map<LocalDate, Int> {
        require(days in 1..MAX_REAGGREGATE_DAYS) { "days 는 1..$MAX_REAGGREGATE_DAYS 이어야 한다: $days" }
        val yesterday = yesterdayKst()
        return (0L until days).associate { back ->
            val day = yesterday.minusDays(back)
            day to aggregate(day).also { rows -> log.info { "[popularity] $day 재집계 ${rows}행" } }
        }
    }

    /**
     * 매일 KST 03:30. links 수집(매시 17분)이 쓰기 전에 그날 기준이 서 있어야 한다.
     *
     * **어제치를 접는다** — 오늘은 아직 끝나지 않았다. 진행 중인 하루를 접으면 그 값이
     * 시간마다 달라져 「어제 대비」 같은 비교가 성립하지 않는다.
     */
    @Scheduled(cron = "\${analytics.attraction-popularity.cron:0 30 3 * * *}", zone = "Asia/Seoul")
    fun aggregateYesterday() {
        val day = yesterdayKst()
        runCatching { aggregate(day) }
            .onSuccess { log.info { "[popularity] $day 집계 ${it}행" } }
            .onFailure { log.error(it) { "[popularity] $day 집계 실패 — 다음 회차에 다시 시도한다" } }
    }

    private fun yesterdayKst(): LocalDate = LocalDate.now(clock.withZone(KST)).minusDays(1)

    private companion object {
        val KST: ZoneId = ZoneId.of("Asia/Seoul")
    }
}
