package com.kgd.ads.infrastructure.persistence.ledger.entity

import com.kgd.ads.domain.ledger.model.LedgerAccountType
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import jakarta.persistence.Version
import java.time.LocalDateTime

@Entity
@Table(name = "ad_ledger_account")
class LedgerAccountJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 32)
    val type: LedgerAccountType,

    @Column(name = "advertiser_id")
    val advertiserId: Long?,

    @Column(name = "created_at", nullable = false)
    val createdAt: LocalDateTime,

    updatedAt: LocalDateTime,
) {
    @Column(name = "balance_micros", nullable = false)
    var balanceMicros: Long = 0
        private set

    @Version
    @Column(name = "version", nullable = false)
    var version: Long = 0
        private set

    @Column(name = "updated_at", nullable = false)
    var updatedAt: LocalDateTime = updatedAt
        private set

    fun apply(amountMicros: Long, at: LocalDateTime) {
        val next = Math.addExact(balanceMicros, amountMicros)
        check(type != LedgerAccountType.ADVERTISER_WALLET || next >= 0) { "지갑 잔액은 음수가 될 수 없습니다: account=$id balance=$balanceMicros amount=$amountMicros" }
        balanceMicros = next
        updatedAt = at
    }

    companion object {
        fun walletOf(advertiserId: Long, now: LocalDateTime) = LedgerAccountJpaEntity(
            type = LedgerAccountType.ADVERTISER_WALLET,
            advertiserId = advertiserId,
            createdAt = now,
            updatedAt = now,
        )
    }
}
