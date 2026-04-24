package com.kgd.sevensplit.application.usecase

import com.kgd.sevensplit.domain.common.StrategyId
import com.kgd.sevensplit.domain.common.TenantId
import java.time.Instant

/**
 * RunBacktestCommand — 백테스트 실행 요청.
 *
 * ## 필드
 *  - `tenantId`, `strategyId` : 조회 대상 전략 (INV-05)
 *  - `from` ~ `to` : 백테스트 기간 (반개구간). `HistoricalMarketDataSource` 가 이 범위를 스캔.
 *  - `seed` : 결정론 보장을 위한 난수 시드. null 이면 UseCase 가 현재 clock millis 로 채움.
 *
 * ## 책임 분리
 *  - 금액/초기 잔고 등 엔진 파라미터는 `RunBacktestUseCase` 생성자에서 주입된 default 를 사용.
 *  - 향후 사용자가 override 하려면 command 필드 확장 (Phase 2 예정).
 */
data class RunBacktestCommand(
    val tenantId: TenantId,
    val strategyId: StrategyId,
    val from: Instant,
    val to: Instant,
    val seed: Long?
)
