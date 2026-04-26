package com.kgd.sevensplit.application.usecase

import com.kgd.sevensplit.application.exception.BacktestRunNotFoundException
import com.kgd.sevensplit.application.port.persistence.BacktestRunRepositoryPort
import com.kgd.sevensplit.application.port.persistence.OrderRepositoryPort
import com.kgd.sevensplit.application.port.persistence.RoundSlotRepositoryPort
import com.kgd.sevensplit.application.port.persistence.StrategyRunRepositoryPort
import com.kgd.sevensplit.application.view.BacktestRunDetailView
import com.kgd.sevensplit.application.view.BacktestRunSummaryView
import com.kgd.sevensplit.application.view.OrderView
import com.kgd.sevensplit.application.view.SlotView
import com.kgd.sevensplit.domain.common.RunId
import com.kgd.sevensplit.domain.common.TenantId
import org.springframework.stereotype.Component

/**
 * GetBacktestRunDetailQuery — 백테스트 실행 상세 (slots + orders 병합).
 *
 * ## 흐름
 *  1. `BacktestRunRepositoryPort.findById` (ClickHouse) — 집계 메타 조회.
 *  2. null 이면 [BacktestRunNotFoundException].
 *  3. `StrategyRunRepositoryPort.findById` 로 MySQL 쪽 run 존재 확인 (tenantId 격리 보강).
 *  4. `RoundSlotRepositoryPort.findByRunId` + 각 slot 의 Order 조회.
 *
 * ## 트랜잭션
 * 순수 조회 — UseCase 에 `@Transactional` 없음 (ADR-0020 §1).
 */
@Component
class GetBacktestRunDetailQuery(
    private val backtestRunRepository: BacktestRunRepositoryPort,
    private val strategyRunRepository: StrategyRunRepositoryPort,
    private val slotRepository: RoundSlotRepositoryPort,
    private val orderRepository: OrderRepositoryPort
) {
    suspend fun execute(tenantId: TenantId, runId: RunId): BacktestRunDetailView {
        val record = backtestRunRepository.findById(tenantId, runId)
            ?: throw BacktestRunNotFoundException(runId, tenantId)

        // MySQL 쪽 run 존재 확인 — 운영 장애로 ClickHouse 와 불일치하면 404 로 통일.
        strategyRunRepository.findById(tenantId, runId)
            ?: throw BacktestRunNotFoundException(runId, tenantId)

        val slots = slotRepository.findByRunId(tenantId, runId)
        val slotViews = slots.map { SlotView.from(it) }
        val orderViews = slots.flatMap { slot ->
            orderRepository.findBySlotId(tenantId, slot.id).map { OrderView.from(it) }
        }

        return BacktestRunDetailView(
            summary = BacktestRunSummaryView.from(record),
            slots = slotViews,
            orders = orderViews
        )
    }
}
