package com.kgd.order.infrastructure.persistence.guard.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

/** 회원별 주문 접수 잠금 행 — 내용은 없고 잠금 대상일 뿐이다 */
@Entity
@Table(name = "member_order_guard")
class MemberOrderGuardJpaEntity(
    @Id
    @Column(name = "user_id", length = 100)
    val userId: String,
    @Column(name = "created_at", nullable = false)
    val createdAt: Instant,
)
