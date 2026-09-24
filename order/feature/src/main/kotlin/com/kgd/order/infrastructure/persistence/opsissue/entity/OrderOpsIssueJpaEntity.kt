package com.kgd.order.infrastructure.persistence.opsissue.entity

import com.kgd.order.domain.opsissue.model.OpsIssueStatus
import com.kgd.order.domain.opsissue.model.OpsIssueType
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

/** order 스키마 운영 이슈 — payment 의 ops_issue 와 같은 모양(운영 큐 화면이 도메인별 목록을 합친다) */
@Entity
@Table(name = "ops_issue")
class OrderOpsIssueJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 30) val type: OpsIssueType,
    @Column(name = "target_id", nullable = false, length = 100) val targetId: String,
    @Column(nullable = false, length = 1000) val detail: String,
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) val status: OpsIssueStatus,
    @Column(name = "actor_id", length = 64) val actorId: String? = null,
    @Column(length = 500) val reason: String? = null,
    @Column(name = "created_at", nullable = false) val createdAt: Instant,
    @Column(name = "updated_at", nullable = false) val updatedAt: Instant,
)
