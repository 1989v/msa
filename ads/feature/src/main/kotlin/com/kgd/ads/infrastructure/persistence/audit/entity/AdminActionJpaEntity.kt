package com.kgd.ads.infrastructure.persistence.audit.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import org.hibernate.annotations.Immutable
import java.time.LocalDateTime

/** 운영자 변경 기록 한 행 — 쓰기만 하고 고치지 않는다. */
@Entity
@Immutable
@Table(name = "ad_admin_action")
class AdminActionJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "actor_member_id", nullable = false)
    val actorMemberId: Long,

    @Column(name = "action", nullable = false, length = 48)
    val action: String,

    @Column(name = "target_type", nullable = false, length = 32)
    val targetType: String,

    @Column(name = "target_id", nullable = false, length = 128)
    val targetId: String,

    @Column(name = "detail", length = 512)
    val detail: String?,

    @Column(name = "created_at", nullable = false)
    val createdAt: LocalDateTime,
)
