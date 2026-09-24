package com.kgd.inventory.infrastructure.startup

import com.kgd.inventory.application.reservation.usecase.ConvertLegacyReservationsUseCase
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.context.SmartLifecycle
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.stereotype.Component

/**
 * 옛 ACTIVE 예약 전환을 기동 때 한 번 돌린다.
 *
 * ApplicationRunner 가 아니라 이른 phase 의 SmartLifecycle 인 이유: 만료 스케줄러(컨텍스트 refresh 이벤트에 시작)와
 * Kafka 리스너(늦은 phase)보다 **먼저** 돌아야 한다 — 스케줄러가 먼저 돌면 30분 지난 옛 예약을 만료시켜
 * 결제된 주문의 재고를 가용으로 되돌린다.
 */
@Component
class LegacyReservationConversionLifecycle(
    private val conversion: ConvertLegacyReservationsUseCase,
) : SmartLifecycle {
    private val log = KotlinLogging.logger {}

    @Volatile
    private var running = false

    override fun start() {
        try {
            conversion.convert()?.let { log.info { "옛 예약 전환 완료: 주문 $it 건" } }
        } catch (e: DataIntegrityViolationException) {
            // 동시에 뜬 다른 인스턴스가 먼저 표식을 남겼다 — 이 인스턴스의 전환은 롤백됐다
            log.info { "옛 예약 전환은 다른 인스턴스가 했다: ${e.message}" }
        }
        running = true
    }

    override fun stop() {
        running = false
    }

    override fun isRunning(): Boolean = running

    override fun getPhase(): Int = PHASE

    companion object {
        /** Kafka 리스너 컨테이너 기본 phase(Int.MAX_VALUE - 100)보다 한참 이르다 */
        const val PHASE = 0
    }
}
