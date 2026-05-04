package com.kgd.quant.domain.common

import com.fasterxml.uuid.Generators
import java.util.UUID

/**
 * OrderId — 주문 식별자.
 *
 * UUID v7 (시간 정렬 + 랜덤) — `com.fasterxml.uuid.Generators.timeBasedEpochGenerator()` (RFC 9562).
 * - 시간 prefix 가 포함되어 DB 인덱스 / sort 친화적
 * - 단조 증가 보장 (생성기 내부 sequence)
 * - I3 (2026-05-05) 정통화 — 이전 v4 fallback 제거
 */
@JvmInline
value class OrderId(val value: UUID) {
    override fun toString(): String = value.toString()

    companion object {
        private val V7 = Generators.timeBasedEpochGenerator()
        fun newV7(): OrderId = OrderId(V7.generate())
        fun of(value: String): OrderId = OrderId(UUID.fromString(value))
    }
}
