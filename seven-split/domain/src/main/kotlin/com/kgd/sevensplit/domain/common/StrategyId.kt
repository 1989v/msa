package com.kgd.sevensplit.domain.common

import java.util.UUID

@JvmInline
value class StrategyId(val value: UUID) {
    override fun toString(): String = value.toString()

    companion object {
        fun newId(): StrategyId = StrategyId(UUID.randomUUID())
        fun of(value: String): StrategyId = StrategyId(UUID.fromString(value))
    }
}
