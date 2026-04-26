package com.kgd.sevensplit.application.backtest

import com.kgd.sevensplit.domain.common.RunId
import com.kgd.sevensplit.domain.common.StrategyId
import com.kgd.sevensplit.domain.common.TenantId
import com.kgd.sevensplit.domain.event.DomainEvent
import com.kgd.sevensplit.domain.order.Execution
import java.math.BigDecimal
import java.time.Instant

/**
 * BacktestResult — 백테스트 1 회 실행 결과 요약.
 *
 * 결정론 회귀 테스트는 이 DTO 의 모든 필드가 동일 입력에 대해 byte-level 로 동일함을 검증한다
 * (TG-05.6).
 *
 * @property runId 이번 실행의 Run 식별자
 * @property tenantId 테넌트
 * @property strategyId 대상 전략
 * @property seed 입력 seed — 동일 seed 재현성 재현을 위해 기록
 * @property events 엔진 루프가 발행한 모든 [DomainEvent] (순서 보존)
 * @property executions 거래소 어댑터에 저장된 모든 체결 (placeOrder 호출 순서)
 * @property realizedPnl 실현 손익 (SELL notional − BUY notional). Phase 1 은 수수료 미포함.
 * @property totalOrders 엔진이 시도한 총 주문 수 (placeOrder 호출 수)
 * @property startedAt 첫 bar timestamp
 * @property endedAt 마지막 bar timestamp (bar 가 0 개이면 `startedAt` 과 동일)
 * @property inputHash CSV + config + seed 해시 — 결정론 추적용
 */
data class BacktestResult(
    val runId: RunId,
    val tenantId: TenantId,
    val strategyId: StrategyId,
    val seed: Long,
    val events: List<DomainEvent>,
    val executions: List<Execution>,
    val realizedPnl: BigDecimal,
    val totalOrders: Int,
    val startedAt: Instant,
    val endedAt: Instant,
    val inputHash: String
)
