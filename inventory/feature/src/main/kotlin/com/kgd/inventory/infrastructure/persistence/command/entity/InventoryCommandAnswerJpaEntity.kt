package com.kgd.inventory.infrastructure.persistence.command.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint
import java.time.LocalDateTime

@Entity
@Table(
    name = "inventory_command_answer",
    uniqueConstraints = [UniqueConstraint(name = "uk_inventory_command_answer", columnNames = ["order_id", "command_key"])],
)
class InventoryCommandAnswerJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(nullable = false)
    val orderId: Long,

    @Column(nullable = false, length = 100)
    val commandKey: String,

    @Column(nullable = false, length = 100)
    val eventType: String,

    // JdbcTypeCode(JSON) 를 달면 String 이 JSON 문자열로 한 번 더 인용된다 — 아웃박스와 같은 매핑
    @Column(nullable = false, columnDefinition = "JSON")
    val payload: String,

    @Column(nullable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),
)
