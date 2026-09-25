package com.kgd.inventory.infrastructure.persistence.command.repository

import com.kgd.inventory.infrastructure.persistence.command.entity.InventoryCommandAnswerJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface InventoryCommandAnswerJpaRepository : JpaRepository<InventoryCommandAnswerJpaEntity, Long> {
    fun findByOrderIdAndCommandKey(orderId: Long, commandKey: String): InventoryCommandAnswerJpaEntity?
}
