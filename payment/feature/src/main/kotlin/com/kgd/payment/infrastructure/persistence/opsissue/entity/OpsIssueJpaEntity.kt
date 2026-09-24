package com.kgd.payment.infrastructure.persistence.opsissue.entity

import com.kgd.payment.domain.opsissue.model.OpsIssue
import com.kgd.payment.domain.opsissue.model.OpsIssueStatus
import com.kgd.payment.domain.opsissue.model.OpsIssueType
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.time.LocalDate

@Entity
@Table(name = "ops_issue")
class OpsIssueJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    val type: OpsIssueType,

    @Column(name = "target_id", nullable = false, length = 100)
    val targetId: String,

    @Column(nullable = false, length = 1000)
    val detail: String,

    @Column(name = "business_date")
    val businessDate: LocalDate?,

    @Column(name = "created_at", nullable = false)
    val createdAt: Instant,
) {
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    var status: OpsIssueStatus = OpsIssueStatus.OPEN
        private set

    @Column(name = "actor_id", length = 64)
    var actorId: String? = null
        private set

    @Column(length = 500)
    var reason: String? = null
        private set

    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = createdAt
        private set

    fun syncFrom(i: OpsIssue) {
        status = i.status
        actorId = i.actorId
        reason = i.reason?.take(500)
        updatedAt = i.updatedAt
    }

    fun toDomain() = OpsIssue.restore(id, type, targetId, detail, businessDate, status, actorId, reason, createdAt, updatedAt)

    companion object {
        fun newFrom(i: OpsIssue) = OpsIssueJpaEntity(
            type = i.type, targetId = i.targetId, detail = i.detail.take(1000), businessDate = i.businessDate, createdAt = i.createdAt,
        ).apply { syncFrom(i) }
    }
}
