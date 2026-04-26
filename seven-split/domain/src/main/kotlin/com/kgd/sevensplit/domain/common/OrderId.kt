package com.kgd.sevensplit.domain.common

import java.util.UUID

/**
 * OrderId — 주문 식별자.
 *
 * - UUID v7(시간 정렬 + 랜덤)을 권장하나, JDK/기본 라이브러리에 v7 생성기가 없다.
 * - TODO: java-uuid-generator 등 v7 생성기를 infra 레벨에 도입 후 `newV7()`를 교체한다.
 *   현재는 `UUID.randomUUID()` (v4) 로 대체.
 */
@JvmInline
value class OrderId(val value: UUID) {
    override fun toString(): String = value.toString()

    companion object {
        fun newV7(): OrderId = OrderId(UUID.randomUUID()) // TODO: swap to UUIDv7 generator
        fun of(value: String): OrderId = OrderId(UUID.fromString(value))
    }
}
