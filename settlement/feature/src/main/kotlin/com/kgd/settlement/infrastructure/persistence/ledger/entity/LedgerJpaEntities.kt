package com.kgd.settlement.infrastructure.persistence.ledger.entity

import com.kgd.settlement.domain.ledger.model.Account
import com.kgd.settlement.domain.ledger.model.EntrySide
import com.kgd.settlement.domain.ledger.model.JournalType
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import org.hibernate.annotations.Immutable
import java.time.Instant

/** 원장 거래 행 — `@Immutable`: 영속성 컨텍스트가 바뀐 값을 UPDATE 로 내보내지 않는다(추가만) */
@Entity
@Immutable
@Table(name = "ledger_journal")
class LedgerJournalJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    val type: JournalType,

    @Column(name = "source_key", nullable = false, length = 120)
    val sourceKey: String,

    @Column(name = "source_event_id", length = 36)
    val sourceEventId: String?,

    @Column(name = "order_id")
    val orderId: Long?,

    @Column(name = "reversal_of")
    val reversalOf: Long?,

    @Column(name = "occurred_at", nullable = false)
    val occurredAt: Instant,

    @Column(name = "created_at", nullable = false)
    val createdAt: Instant,
)

@Entity
@Immutable
@Table(name = "ledger_entry")
class LedgerEntryJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "journal_id", nullable = false)
    val journalId: Long,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    val account: Account,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    val side: EntrySide,

    @Column(nullable = false)
    val amount: Long,

    @Column(name = "seller_id")
    val sellerId: Long?,
)
