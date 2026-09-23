package com.kgd.ads.domain.decision.policy

import java.time.Clock
import java.time.LocalTime
import kotlin.random.Random

/**
 * 일예산 페이싱. 하루 경과 비율보다 소진 비율이 앞서면 그 차만큼 통과 확률을 낮춘다.
 * 「하루」는 [clock] 의 시간대 달력일이다 — ads 는 KST 시계를 넘긴다.
 */
class Pacing(private val clock: Clock) {

    fun passProbability(spentTodayMicros: Long, dailyBudgetMicros: Long): Double {
        val elapsed = LocalTime.now(clock).toSecondOfDay().toDouble() / SECONDS_PER_DAY
        val spent = spentTodayMicros.toDouble() / dailyBudgetMicros
        return (1.0 - (spent - elapsed).coerceAtLeast(0.0)).coerceAtLeast(0.0)
    }

    fun passes(spentTodayMicros: Long, dailyBudgetMicros: Long, random: Random): Boolean =
        random.nextDouble() < passProbability(spentTodayMicros, dailyBudgetMicros)

    private companion object {
        const val SECONDS_PER_DAY = 86_400.0
    }
}
