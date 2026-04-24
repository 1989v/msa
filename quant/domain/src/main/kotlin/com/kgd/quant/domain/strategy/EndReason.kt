package com.kgd.quant.domain.strategy

/**
 * StrategyRun 종료 사유.
 */
enum class EndReason {
    COMPLETED,
    USER_LIQUIDATED,
    EMERGENCY_LIQUIDATED,
    RISK_LIMIT_BREACHED,
    EXCHANGE_ERROR
}
