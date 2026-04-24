package com.kgd.sevensplit.domain.strategy

import com.kgd.sevensplit.domain.exception.IllegalStrategyTransitionException

/**
 * StrategyRun 단위 실행 상태.
 *
 * 전이 테이블:
 *   INITIALIZED         → ACTIVE
 *   ACTIVE              ↔ AWAITING_EXHAUSTED
 *   ACTIVE              → LIQUIDATING
 *   AWAITING_EXHAUSTED  → LIQUIDATING
 *   LIQUIDATING         → CLOSED
 *   CLOSED              → (종료)
 */
enum class StrategyRunStatus {
    INITIALIZED,
    ACTIVE,
    AWAITING_EXHAUSTED,
    LIQUIDATING,
    CLOSED;

    fun ensureTransition(to: StrategyRunStatus) {
        val allowed = when (this) {
            INITIALIZED -> to == ACTIVE
            ACTIVE -> to == AWAITING_EXHAUSTED || to == LIQUIDATING
            AWAITING_EXHAUSTED -> to == ACTIVE || to == LIQUIDATING
            LIQUIDATING -> to == CLOSED
            CLOSED -> false
        }
        if (!allowed) {
            throw IllegalStrategyTransitionException(
                "Illegal strategy run transition: $this -> $to"
            )
        }
    }
}
