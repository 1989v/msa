package com.kgd.ads.infrastructure.persistence.ledger.entity

import com.kgd.ads.domain.ledger.model.LedgerTransactionType
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime

@Entity
@Table(name = "ad_ledger_transaction")
class LedgerTransactionJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 16)
    val type: LedgerTransactionType,

    @Column(name = "idempotency_key", nullable = false, length = 128)
    val idempotencyKey: String,

    @Column(name = "reversed_transaction_id")
    val reversedTransactionId: Long? = null,

    @Column(name = "actor_member_id")
    val actorMemberId: Long?,

    @Column(name = "created_at", nullable = false)
    val createdAt: LocalDateTime,
)
