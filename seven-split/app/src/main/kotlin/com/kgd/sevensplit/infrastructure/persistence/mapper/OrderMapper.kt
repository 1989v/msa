package com.kgd.sevensplit.infrastructure.persistence.mapper

import com.kgd.sevensplit.domain.common.OrderId
import com.kgd.sevensplit.domain.common.Price
import com.kgd.sevensplit.domain.common.Quantity
import com.kgd.sevensplit.domain.common.SlotId
import com.kgd.sevensplit.domain.common.TenantId
import com.kgd.sevensplit.domain.order.Order
import com.kgd.sevensplit.domain.order.OrderSide
import com.kgd.sevensplit.domain.order.OrderStatus
import com.kgd.sevensplit.domain.order.SpotOrderType
import com.kgd.sevensplit.infrastructure.persistence.entity.OrderEntity
import java.time.Instant

/**
 * TG-08.4: `Order` ↔ `OrderEntity` 변환.
 *
 * `SpotOrderType` sealed 계층은 `type_name` (MARKET|LIMIT) + `price` 로 평탄화되어 저장되고,
 * 역변환 시 type_name 기반으로 서브타입을 재구성한다.
 */
object OrderMapper {

    private const val TYPE_MARKET = "MARKET"
    private const val TYPE_LIMIT = "LIMIT"

    fun toEntity(
        domain: Order,
        tenantId: TenantId,
        createdAt: Instant,
        updatedAt: Instant
    ): OrderEntity {
        val (typeName, priceValue) = when (val type = domain.type) {
            SpotOrderType.Market -> TYPE_MARKET to null
            is SpotOrderType.Limit -> TYPE_LIMIT to type.price.value
        }
        return OrderEntity(
            orderId = domain.orderId.value,
            slotId = domain.slotId.value,
            tenantId = tenantId.value,
            side = domain.side.name,
            typeName = typeName,
            quantity = domain.quantity.value,
            price = priceValue,
            status = domain.status.name,
            exchangeOrderId = domain.exchangeOrderId,
            filledQuantity = domain.filledQuantity.value,
            createdAt = createdAt,
            updatedAt = updatedAt
        )
    }

    fun applyToEntity(
        entity: OrderEntity,
        domain: Order,
        tenantId: TenantId,
        updatedAt: Instant
    ): OrderEntity {
        val (typeName, priceValue) = when (val type = domain.type) {
            SpotOrderType.Market -> TYPE_MARKET to null
            is SpotOrderType.Limit -> TYPE_LIMIT to type.price.value
        }
        entity.slotId = domain.slotId.value
        entity.tenantId = tenantId.value
        entity.side = domain.side.name
        entity.typeName = typeName
        entity.quantity = domain.quantity.value
        entity.price = priceValue
        entity.status = domain.status.name
        entity.exchangeOrderId = domain.exchangeOrderId
        entity.filledQuantity = domain.filledQuantity.value
        entity.updatedAt = updatedAt
        return entity
    }

    fun toDomain(entity: OrderEntity): Order {
        val type: SpotOrderType = when (entity.typeName) {
            TYPE_MARKET -> SpotOrderType.Market
            TYPE_LIMIT -> {
                val priceValue = entity.price
                    ?: error("OrderEntity.price must be non-null for LIMIT type (orderId=${entity.orderId})")
                SpotOrderType.Limit(Price(priceValue))
            }

            else -> error("Unknown OrderEntity.type_name=${entity.typeName} (orderId=${entity.orderId})")
        }
        val domainPrice: Price? = when (type) {
            SpotOrderType.Market -> null
            is SpotOrderType.Limit -> type.price
        }
        return Order.reconstruct(
            orderId = OrderId(entity.orderId),
            slotId = SlotId(entity.slotId),
            side = OrderSide.valueOf(entity.side),
            type = type,
            quantity = Quantity(entity.quantity),
            price = domainPrice,
            status = OrderStatus.valueOf(entity.status),
            exchangeOrderId = entity.exchangeOrderId,
            filledQuantity = Quantity(entity.filledQuantity)
        )
    }
}
