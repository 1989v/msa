package com.kgd.settlement.infrastructure.persistence.seller.entity

import com.kgd.settlement.domain.seller.model.SettlementSeller
import com.kgd.settlement.domain.statement.model.SettlementCycle
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

@Entity
@Table(name = "settlement_seller")
class SettlementSellerJpaEntity(
    @Id
    @Column(name = "seller_id", nullable = false)
    val sellerId: Long,

    @Column(name = "member_id", nullable = false, length = 64)
    var memberId: String,

    @Column(nullable = false, length = 20)
    var status: String,

    @Enumerated(EnumType.STRING)
    @Column(name = "settlement_cycle", nullable = false, length = 20)
    var cycle: SettlementCycle,

    @Column(name = "occurred_at", nullable = false)
    var occurredAt: Instant,
) {
    fun syncFrom(s: SettlementSeller) {
        memberId = s.memberId
        status = s.status
        cycle = s.cycle
        occurredAt = s.occurredAt
    }

    fun toDomain() = SettlementSeller(sellerId, memberId, status, cycle, occurredAt)
}
