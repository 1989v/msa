package com.kgd.place.infrastructure.persistence.market.entity

import com.kgd.place.domain.market.model.MarketActorKind
import com.kgd.place.domain.market.model.MarketStoreField
import com.kgd.place.domain.market.model.MarketStoreOverride
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
@Table(name = "market_store_override")
class MarketStoreOverrideJpaEntity(
    @Column(name = "store_id", nullable = false)
    val storeId: Long,
    @Enumerated(EnumType.STRING)
    @Column(name = "field", nullable = false, length = 30, columnDefinition = "varchar(30)")
    val field: MarketStoreField,
    @Column(name = "value", nullable = true, columnDefinition = "text")
    val value: String?,
    @Column(name = "reason", nullable = false, length = 1000)
    val reason: String,
    @Column(name = "member_id", nullable = false)
    val memberId: Long,
    @Enumerated(EnumType.STRING)
    @Column(name = "actor_kind", nullable = false, length = 20, columnDefinition = "varchar(20)")
    val actorKind: MarketActorKind,
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: LocalDateTime,
) {
    fun toDomain(): MarketStoreOverride = MarketStoreOverride(
        storeId = storeId,
        field = field,
        value = value,
        reason = reason,
        memberId = memberId,
        actorKind = actorKind,
        id = id,
        createdAt = createdAt,
    )

    companion object {
        fun fromDomain(row: MarketStoreOverride): MarketStoreOverrideJpaEntity = MarketStoreOverrideJpaEntity(
            storeId = row.storeId,
            field = row.field,
            value = row.value,
            reason = row.reason,
            memberId = row.memberId,
            actorKind = row.actorKind,
            id = row.id,
            createdAt = row.createdAt,
        )
    }
}
