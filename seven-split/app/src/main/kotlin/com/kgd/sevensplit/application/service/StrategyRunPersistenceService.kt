package com.kgd.sevensplit.application.service

import com.kgd.sevensplit.application.port.persistence.RoundSlotRepositoryPort
import com.kgd.sevensplit.application.port.persistence.StrategyRunRepositoryPort
import com.kgd.sevensplit.domain.common.ExecutionMode
import com.kgd.sevensplit.domain.common.Quantity
import com.kgd.sevensplit.domain.common.SlotId
import com.kgd.sevensplit.domain.slot.RoundSlot
import com.kgd.sevensplit.domain.strategy.EndReason
import com.kgd.sevensplit.domain.strategy.SplitStrategy
import com.kgd.sevensplit.domain.strategy.StrategyRun
import com.kgd.sevensplit.domain.strategy.StrategyRunStatus
import org.springframework.stereotype.Component
import java.math.BigDecimal
import java.time.Instant

/**
 * StrategyRunPersistenceService — `RunBacktestUseCase` 의 짧은 DB 쓰기 구간만 담당하는 보조 서비스.
 *
 * ## @Transactional 설계 결정 (ADR-0020)
 * - JPA Repository 어댑터들이 이미 `withContext(Dispatchers.IO)` 로 thread 를 옮기고 각 호출이
 *   자체 트랜잭션을 가지고 있어, 서비스 레벨 `@Transactional` 을 씌워도 프록시 트랜잭션이 바깥
 *   thread 에 열리고 실제 JPA 호출은 IO thread 에 있어 참여하지 못한다. 이 impedance 를 감안해
 *   **서비스 레벨 `@Transactional` 을 걸지 않는다**.
 * - Outbox append + 상태 전이의 원자성 (INV-04) 이 엄격히 요구되는 경로는 Phase 2 에서 명시적
 *   blocking adapter 를 도입하거나 JPA 를 co-located 로 재정렬해 재설계한다.
 * - Phase 1 백테스트는 단일 사용자 / 배치 성격이라 짧은 동시성 구간만 존재 — 개별 save 가 자체
 *   트랜잭션으로 커밋되는 것만으로 충분하다.
 *
 * ## 책임
 * - [initializeRun] : StrategyRun + 회차 슬롯 N 개 영속화.
 * - [finalizeRun]   : 엔진 실행 후 run.end(...) + update.
 *
 * 외부 IO (엔진 시뮬레이션, ClickHouse 저장) 는 이 서비스 밖에서 수행된다.
 */
@Component
class StrategyRunPersistenceService(
    private val runRepository: StrategyRunRepositoryPort,
    private val slotRepository: RoundSlotRepositoryPort
) {

    /**
     * 백테스트용 `StrategyRun` + `RoundSlot` N 개를 DB 에 영속화.
     *
     * ## Phase 1 단순화 (targetQty placeholder)
     * 정식 targetQty 산출은 Phase 2 에서 엔진이 첫 bar close 로 재계산하도록 한다. 현재는 도메인
     * 모델 타입 제약을 맞추기 위해 `Quantity(BigDecimal.ONE)` placeholder 를 사용한다
     * (백테스트 엔진의 체결가가 실제 pnl 계산에 사용되므로 뒤이어지는 로직에는 영향 없음).
     * TODO: Phase 2 에서 정식 명목 → 수량 계산 도입.
     */
    suspend fun initializeRun(
        strategy: SplitStrategy,
        startedAt: Instant,
        seed: Long
    ): Pair<StrategyRun, MutableList<RoundSlot>> {
        val run = StrategyRun.create(
            strategyId = strategy.id,
            tenantId = strategy.tenantId,
            startedAt = startedAt,
            executionMode = ExecutionMode.BACKTEST,
            seed = seed
        )
        val slots = mutableListOf<RoundSlot>()
        for (index in 0 until strategy.config.roundCount) {
            val slot = RoundSlot.create(
                id = SlotId.newId(),
                runId = run.id,
                roundIndex = index,
                // TODO: Phase 2 — 초기 가격 기준 target 수량 재계산.
                targetQty = Quantity(BigDecimal.ONE),
                takeProfitPercent = strategy.config.takeProfitPercentAt(index)
            )
            slots.add(slot)
        }

        runRepository.save(run)
        for (slot in slots) {
            slotRepository.save(slot)
        }
        return run to slots
    }

    /**
     * 엔진 실행이 끝난 뒤 `StrategyRun` 을 LIQUIDATING → CLOSED 로 전이하고 DB 에 갱신한다.
     *
     * 엔진이 이미 `run.end(...)` 를 호출해 status 를 전이시켰을 수 있으므로 현재 상태를 확인해
     * 중복 전이를 방지한다 (엔진 측 책임과의 이중 안전장치).
     */
    suspend fun finalizeRun(run: StrategyRun, endedAt: Instant, reason: EndReason) {
        if (run.status != StrategyRunStatus.CLOSED) {
            if (run.status == StrategyRunStatus.AWAITING_EXHAUSTED) {
                run.backToActive()
            }
            if (run.status == StrategyRunStatus.ACTIVE) {
                run.beginLiquidation()
            }
            if (run.status == StrategyRunStatus.LIQUIDATING) {
                run.end(reason, endedAt)
            }
        }
        runRepository.save(run)
    }
}
