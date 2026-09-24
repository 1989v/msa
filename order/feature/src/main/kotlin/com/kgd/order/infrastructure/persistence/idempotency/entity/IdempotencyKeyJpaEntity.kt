package com.kgd.order.infrastructure.persistence.idempotency.entity

import com.kgd.order.domain.idempotency.model.IdempotencyStatus
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint
import java.time.Instant

/** 주문 접수 멱등 키 — (user_id, idem_key) 유니크. 완료 응답을 스냅샷으로 담고 24시간 뒤 지운다 */
@Entity
@Table(
    name = "idempotency_key",
    uniqueConstraints = [UniqueConstraint(name = "uk_idempotency_key_user_key", columnNames = ["user_id", "idem_key"])],
)
class IdempotencyKeyJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(name = "user_id", nullable = false, length = 100) val userId: String,
    @Column(name = "idem_key", nullable = false, length = 100) val idemKey: String,
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) var status: IdempotencyStatus,
    @Column(name = "lease_until", nullable = false) var leaseUntil: Instant,
    @Column(name = "response", length = 2000) var response: String?,
    @Column(name = "created_at", nullable = false) val createdAt: Instant,
)
