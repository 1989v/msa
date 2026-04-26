package com.kgd.sevensplit.domain.strategy

import com.kgd.sevensplit.domain.exception.IllegalStrategyTransitionException

/**
 * SplitStrategy 라이프사이클 상태.
 *
 * 전이 테이블:
 *   DRAFT      → ACTIVE
 *   ACTIVE     → PAUSED | LIQUIDATED
 *   PAUSED     → ACTIVE  | LIQUIDATED
 *   LIQUIDATED → ARCHIVED
 *   ARCHIVED   → (종료)
 */
enum class StrategyStatus {
    DRAFT,
    ACTIVE,
    PAUSED,
    LIQUIDATED,
    ARCHIVED;

    fun ensureTransition(to: StrategyStatus) {
        val allowed = when (this) {
            DRAFT -> to == ACTIVE
            ACTIVE -> to == PAUSED || to == LIQUIDATED
            PAUSED -> to == ACTIVE || to == LIQUIDATED
            LIQUIDATED -> to == ARCHIVED
            ARCHIVED -> false
        }
        if (!allowed) {
            throw IllegalStrategyTransitionException(
                "Illegal strategy transition: $this -> $to"
            )
        }
    }
}
