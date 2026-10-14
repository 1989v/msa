package com.kgd.place.infrastructure.persistence.market.entity

import com.kgd.place.domain.market.model.MarketActorKind
import com.kgd.place.domain.market.model.MarketChangeAction
import com.kgd.place.domain.market.model.MarketChangeLog
import com.kgd.place.domain.market.model.MarketChangeTarget
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
@Table(name = "market_change_log")
class MarketChangeLogJpaEntity(
    @Column(name = "market_id", nullable = false)
    val marketId: Long,
    @Enumerated(EnumType.STRING)
    @Column(name = "target", nullable = false, length = 20, columnDefinition = "varchar(20)")
    val target: MarketChangeTarget,
    @Column(name = "target_id", nullable = false)
    val targetId: Long,
    @Enumerated(EnumType.STRING)
    @Column(name = "action", nullable = false, length = 20, columnDefinition = "varchar(20)")
    val action: MarketChangeAction,
    @Column(name = "member_id", nullable = false)
    val memberId: Long,
    @Enumerated(EnumType.STRING)
    @Column(name = "actor_kind", nullable = false, length = 20, columnDefinition = "varchar(20)")
    val actorKind: MarketActorKind,
    @Column(name = "before_raw", nullable = true, columnDefinition = "json")
    val beforeRaw: String?,
    @Column(name = "after_raw", nullable = true, columnDefinition = "json")
    val afterRaw: String?,
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: LocalDateTime,
) {
    fun toDomain(): MarketChangeLog = MarketChangeLog(
        marketId = marketId,
        target = target,
        targetId = targetId,
        action = action,
        memberId = memberId,
        actorKind = actorKind,
        beforeRaw = beforeRaw,
        afterRaw = afterRaw,
        id = id,
        createdAt = createdAt,
    )

    companion object {
        fun fromDomain(row: MarketChangeLog): MarketChangeLogJpaEntity = MarketChangeLogJpaEntity(
            marketId = row.marketId,
            target = row.target,
            targetId = row.targetId,
            action = row.action,
            memberId = row.memberId,
            actorKind = row.actorKind,
            beforeRaw = row.beforeRaw,
            afterRaw = row.afterRaw,
            id = row.id,
            createdAt = row.createdAt,
        )
    }
}
