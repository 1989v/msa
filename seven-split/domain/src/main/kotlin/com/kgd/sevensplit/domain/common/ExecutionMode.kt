package com.kgd.sevensplit.domain.common

/**
 * ExecutionMode — 전략 실행 모드.
 *
 * - BACKTEST: 과거 데이터 기반 검증 (Phase 1)
 * - PAPER: 실시간 시세 + 가상 체결 (Phase 2)
 * - LIVE: 실거래소 주문 (Phase 3)
 */
enum class ExecutionMode {
    BACKTEST,
    PAPER,
    LIVE
}
