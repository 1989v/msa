package com.kgd.ads.infrastructure.persistence.ledger.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime

@Entity
@Table(name = "ad_ledger_entry")
class LedgerEntryJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "transaction_id", nullable = false)
    val transactionId: Long,

    @Column(name = "account_id", nullable = false)
    val accountId: Long,

    @Column(name = "amount_micros", nullable = false)
    val amountMicros: Long,

    @Column(name = "created_at", nullable = false)
    val createdAt: LocalDateTime,
)
