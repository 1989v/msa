package com.kgd.sevensplit.domain.common

import java.util.UUID

@JvmInline
value class RunId(val value: UUID) {
    override fun toString(): String = value.toString()

    companion object {
        fun newId(): RunId = RunId(UUID.randomUUID())
        fun of(value: String): RunId = RunId(UUID.fromString(value))
    }
}
