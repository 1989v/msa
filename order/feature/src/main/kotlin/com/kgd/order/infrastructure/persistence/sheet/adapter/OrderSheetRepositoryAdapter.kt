package com.kgd.order.infrastructure.persistence.sheet.adapter

import com.kgd.order.application.sheet.port.OrderSheetRepositoryPort
import com.kgd.order.domain.sheet.exception.OrderSheetNotFoundException
import com.kgd.order.domain.sheet.model.OrderSheet
import com.kgd.order.infrastructure.persistence.sheet.entity.OrderSheetJpaEntity
import com.kgd.order.infrastructure.persistence.sheet.repository.OrderSheetJpaRepository
import org.springframework.stereotype.Component

/** 호출자의 order 트랜잭션 안에서 부른다 — 라인·배송비 컬렉션은 지연 로딩이다 */
@Component
class OrderSheetRepositoryAdapter(
    private val jpa: OrderSheetJpaRepository,
) : OrderSheetRepositoryPort {

    override fun save(sheet: OrderSheet): OrderSheet {
        val id = sheet.id ?: return jpa.saveAndFlush(OrderSheetJpaEntity.from(sheet)).toDomain()
        val entity = jpa.findById(id).orElseThrow { OrderSheetNotFoundException(id) }
        entity.applyUsage(sheet)
        return jpa.saveAndFlush(entity).toDomain()
    }

    override fun findById(id: Long): OrderSheet? = jpa.findById(id).orElse(null)?.toDomain()
}
