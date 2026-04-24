package com.kgd.sevensplit.application.usecase

import com.kgd.sevensplit.application.exception.NotImplementedInPhase1Exception
import com.kgd.sevensplit.domain.common.StrategyId
import com.kgd.sevensplit.domain.common.TenantId
import org.springframework.stereotype.Component

/**
 * ExecuteLiquidationUseCase — Phase 3 실매매 긴급 청산.
 *
 * Phase 1 에서는 호출 자체를 차단하기 위해 [NotImplementedInPhase1Exception] 만 던진다.
 * REST 컨트롤러에서 이 예외를 501 Not Implemented 로 매핑할 수 있게 남겨 둠.
 *
 * ## Phase 3 설계 메모 (참고)
 *  - 실거래소 `ExchangeAdapter.cancelOrder` 전량 + 잔여 포지션 시장가 매도.
 *  - `EmergencyLiquidationTriggered` 이벤트 Outbox append.
 *  - `StrategyRun.beginLiquidation() → end(USER_LIQUIDATED)` 전이.
 */
@Component
class ExecuteLiquidationUseCase {

    @Suppress("UNUSED_PARAMETER")
    suspend fun execute(tenantId: TenantId, strategyId: StrategyId) {
        throw NotImplementedInPhase1Exception(
            feature = "ExecuteLiquidationUseCase (Phase 3 emergency liquidation)"
        )
    }
}
