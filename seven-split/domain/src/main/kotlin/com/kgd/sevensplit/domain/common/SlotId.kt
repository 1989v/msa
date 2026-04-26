package com.kgd.sevensplit.domain.common

import java.util.UUID

@JvmInline
value class SlotId(val value: UUID) {
    override fun toString(): String = value.toString()

    companion object {
        fun newId(): SlotId = SlotId(UUID.randomUUID())
        fun of(value: String): SlotId = SlotId(UUID.fromString(value))
    }
}
