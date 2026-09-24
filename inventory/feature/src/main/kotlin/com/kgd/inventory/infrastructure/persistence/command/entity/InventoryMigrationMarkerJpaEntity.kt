package com.kgd.inventory.infrastructure.persistence.command.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime

@Entity
@Table(name = "inventory_migration_marker")
class InventoryMigrationMarkerJpaEntity(
    @Id
    @Column(length = 100)
    val name: String,

    @Column(nullable = false)
    val appliedAt: LocalDateTime = LocalDateTime.now(),
)
