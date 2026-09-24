package com.kgd.inventory.infrastructure.persistence.command.repository

import com.kgd.inventory.infrastructure.persistence.command.entity.InventoryCommandAnswerJpaEntity
import com.kgd.inventory.infrastructure.persistence.command.entity.InventoryMigrationMarkerJpaEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface InventoryCommandAnswerJpaRepository : JpaRepository<InventoryCommandAnswerJpaEntity, Long> {
    fun findByOrderIdAndCommandKey(orderId: Long, commandKey: String): InventoryCommandAnswerJpaEntity?
    fun existsByOrderIdAndCommandKey(orderId: Long, commandKey: String): Boolean
}

interface InventoryMigrationMarkerJpaRepository : JpaRepository<InventoryMigrationMarkerJpaEntity, String> {
    /** save() 는 id 가 있으면 merge 라 이미 있는 행을 덮는다 — 두 번째 삽입이 PK 위반으로 실패해야 한다 */
    @Modifying
    @Query(value = "INSERT INTO inventory_migration_marker (name, applied_at) VALUES (:name, NOW(6))", nativeQuery = true)
    fun insert(@Param("name") name: String): Int
}
