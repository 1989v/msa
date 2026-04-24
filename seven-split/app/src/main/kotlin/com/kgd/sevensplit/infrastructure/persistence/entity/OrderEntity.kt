package com.kgd.sevensplit.infrastructure.persistence.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.math.BigDecimal
import java.time.Instant
import java.util.UUID

/**
 * TG-08.2: `order` 테이블 매핑 Entity.
 *
 * 테이블명 `order` 가 MySQL 예약어이므로 `@Table(name = "order")` 뒤에 실제 쿼리 생성 시
 * Hibernate 가 백틱 wrap 을 보장한다 (MySQL dialect 기본 동작). 명시성을 위해 `\`order\`` 를 사용.
 *
 * 도메인 `Order` 의 `SpotOrderType` (Market/Limit sealed) 은 `type_name` + `price` 로 평탄화된다.
 * - Market: type_name="MARKET", price=null
 * - Limit:  type_name="LIMIT",  price=<non-null>
 */
@Entity
@Table(name = "`order`")
class OrderEntity(
    @Id
    @Column(name = "order_id", columnDefinition = "BINARY(16)", nullable = false)
    var orderId: UUID = UUID.randomUUID(),

    @Column(name = "slot_id", columnDefinition = "BINARY(16)", nullable = false)
    var slotId: UUID = UUID.randomUUID(),

    @Column(name = "tenant_id", nullable = false, length = 64)
    var tenantId: String = "",

    @Column(name = "side", nullable = false, length = 8)
    var side: String = "",

    @Column(name = "type_name", nullable = false, length = 16)
    var typeName: String = "",

    @Column(name = "quantity", nullable = false, precision = 38, scale = 8)
    var quantity: BigDecimal = BigDecimal.ZERO,

    @Column(name = "price", nullable = true, precision = 38, scale = 8)
    var price: BigDecimal? = null,

    @Column(name = "status", nullable = false, length = 32)
    var status: String = "",

    @Column(name = "exchange_order_id", nullable = true, length = 128)
    var exchangeOrderId: String? = null,

    @Column(name = "filled_quantity", nullable = false, precision = 38, scale = 8)
    var filledQuantity: BigDecimal = BigDecimal.ZERO,

    @Column(name = "created_at", nullable = false)
    var createdAt: Instant = Instant.now(),

    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = Instant.now()
)
