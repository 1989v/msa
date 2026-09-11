package com.kgd.codedictionary.infrastructure.persistence.resume.entity

import com.kgd.codedictionary.domain.resume.model.ResumeDocument
import com.kgd.codedictionary.domain.resume.model.ResumeDocumentKind
import com.kgd.codedictionary.domain.resume.model.ResumeShareLink
import com.kgd.codedictionary.domain.resume.model.ResumeVisibility
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import org.hibernate.annotations.CreationTimestamp
import org.hibernate.annotations.UpdateTimestamp
import java.time.LocalDateTime

@Entity
@Table(name = "resume_document")
class ResumeDocumentJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(nullable = false, length = 80, unique = true)
    val slug: String = "",

    title: String = "",
    bodyMarkdown: String = "",
    kind: ResumeDocumentKind = ResumeDocumentKind.DETAIL,
    orderNo: Int = 0,
    published: Boolean = true,

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    var updatedAt: LocalDateTime = LocalDateTime.now(),
) {
    @Column(nullable = false, length = 200)
    var title: String = title
        private set

    @Column(name = "body_markdown", nullable = false, columnDefinition = "MEDIUMTEXT")
    var bodyMarkdown: String = bodyMarkdown
        private set

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    var kind: ResumeDocumentKind = kind
        private set

    @Column(name = "order_no", nullable = false)
    var orderNo: Int = orderNo
        private set

    @Column(nullable = false)
    var published: Boolean = published
        private set

    /** 전체 동기화 — 도메인 모델 기준으로 영속 상태를 덮어쓴다 (entity-mutation.md) */
    fun update(document: ResumeDocument) {
        title = document.title
        bodyMarkdown = document.bodyMarkdown
        kind = document.kind
        orderNo = document.orderNo
        published = document.published
    }

    fun toDomain(): ResumeDocument = ResumeDocument.restore(
        id = id,
        slug = slug,
        title = title,
        bodyMarkdown = bodyMarkdown,
        kind = kind,
        orderNo = orderNo,
        published = published,
        createdAt = createdAt,
        updatedAt = updatedAt,
    )

    companion object {
        fun fromDomain(document: ResumeDocument) = ResumeDocumentJpaEntity(
            id = document.id,
            slug = document.slug,
            title = document.title,
            bodyMarkdown = document.bodyMarkdown,
            kind = document.kind,
            orderNo = document.orderNo,
            published = document.published,
        )
    }
}

@Entity
@Table(name = "resume_share_link")
class ResumeShareLinkJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(nullable = false, length = 64, unique = true)
    val token: String = "",

    @Column(nullable = false, length = 120)
    val label: String = "",

    @Column(length = 500)
    val note: String? = null,

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),
) {
    @Column(name = "revoked_at")
    var revokedAt: LocalDateTime? = null
        private set

    fun revoke(at: LocalDateTime = LocalDateTime.now()) {
        if (revokedAt == null) revokedAt = at
    }

    fun toDomain(): ResumeShareLink = ResumeShareLink.restore(
        id = id,
        token = token,
        label = label,
        note = note,
        createdAt = createdAt,
        revokedAt = revokedAt,
    )

    companion object {
        fun fromDomain(link: ResumeShareLink) = ResumeShareLinkJpaEntity(
            id = link.id,
            token = link.token,
            label = link.label,
            note = link.note,
        )
    }
}

/** 열람 기록. 수집 범위를 토큰·경로·시각으로 한정한다 (ADR-0064). */
@Entity
@Table(name = "resume_access_log")
class ResumeAccessLogJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "share_link_id")
    val shareLinkId: Long? = null,

    @Column(nullable = false, length = 80)
    val slug: String = "",

    @Column(name = "visited_at", nullable = false)
    val visitedAt: LocalDateTime = LocalDateTime.now(),
)

@Entity
@Table(name = "resume_setting")
class ResumeSettingJpaEntity(
    @Id
    val id: Long = SINGLETON_ID,

    visibility: ResumeVisibility = ResumeVisibility.TOKEN_ONLY,

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    var updatedAt: LocalDateTime = LocalDateTime.now(),
) {
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    var visibility: ResumeVisibility = visibility
        private set

    fun changeVisibility(next: ResumeVisibility) {
        visibility = next
    }

    companion object {
        /** 설정은 단일 행 (V6 마이그레이션에서 삽입) */
        const val SINGLETON_ID = 1L
    }
}
