package com.kgd.game.infrastructure.scheduler

import com.kgd.game.infrastructure.persistence.catalog.repository.GameStatsJpaRepository
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional

/**
 * TRENDING 정렬의 주간성 보장 — weekly_play_count 를 매주 월요일 00:00(KST) 초기화.
 * ADR-0058 티어링: 경량 @Scheduled 는 API JVM 코로케이트 (단일 replica 라 중복 실행 없음).
 */
@Component
class GameStatsWeeklyResetScheduler(
    private val statsRepository: GameStatsJpaRepository,
) {
    private val log = KotlinLogging.logger {}

    @Scheduled(cron = "0 0 0 * * MON", zone = "Asia/Seoul")
    @Transactional(transactionManager = "gameTransactionManager")
    fun resetWeekly() {
        val reset = statsRepository.resetAllWeekly()
        log.info { "게임 주간 플레이 카운트 리셋 완료: ${reset}건" }
    }
}
