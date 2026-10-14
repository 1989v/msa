package com.kgd.place.infrastructure.persistence.market.entity

import com.kgd.place.domain.market.model.MarketSteward
import com.kgd.place.domain.market.model.MarketStewardStatus
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
@Table(name = "market_steward")
class MarketStewardJpaEntity(
    @Column(name = "market_id", nullable = false)
    val marketId: Long,
    @Column(name = "member_id", nullable = false)
    val memberId: Long,
    @Column(name = "org_name", nullable = false, length = 300)
    val orgName: String,
    @Column(name = "contact", nullable = false, length = 500)
    val contact: String,
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20, columnDefinition = "varchar(20)")
    val status: MarketStewardStatus,
    @Column(name = "approved_by_member_id", nullable = true)
    val approvedByMemberId: Long?,
    @Column(name = "approved_at", nullable = true)
    val approvedAt: LocalDateTime?,
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: LocalDateTime,
) {
    fun toDomain(): MarketSteward = MarketSteward(
        marketId = marketId,
        memberId = memberId,
        orgName = orgName,
        contact = contact,
        status = status,
        approvedByMemberId = approvedByMemberId,
        approvedAt = approvedAt,
        id = id,
        createdAt = createdAt,
    )

    companion object {
        fun fromDomain(row: MarketSteward): MarketStewardJpaEntity = MarketStewardJpaEntity(
            marketId = row.marketId,
            memberId = row.memberId,
            orgName = row.orgName,
            contact = row.contact,
            status = row.status,
            approvedByMemberId = row.approvedByMemberId,
            approvedAt = row.approvedAt,
            id = row.id,
            createdAt = row.createdAt,
        )
    }
}
