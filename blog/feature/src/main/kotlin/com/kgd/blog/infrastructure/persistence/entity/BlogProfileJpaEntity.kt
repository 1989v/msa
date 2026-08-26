package com.kgd.blog.infrastructure.persistence.entity

import com.kgd.blog.domain.model.BlogProfile
import com.kgd.blog.domain.model.ProfileRole
import com.kgd.blog.domain.model.ProfileStatus
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime

/**
 * 블로그 신원 (ADR-0072 §2). 작성 권한의 원본이 이 행이다 —
 * 정지(`status`)는 다음 요청부터 즉시 먹는다. JWT 클레임에 권한을 실었다면 토큰이 만료될
 * 때까지 못 막았을 것이다.
 */
@Entity
@Table(name = "blog_profile")
class BlogProfileJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "member_id", nullable = false, unique = true)
    val memberId: Long = 0,

    handle: String? = null,
    displayName: String = "",
    bio: String? = null,
    avatarUrl: String? = null,
    role: ProfileRole = ProfileRole.READER,
    status: ProfileStatus = ProfileStatus.ACTIVE,
) {
    @Column(length = 30, unique = true)
    var handle: String? = handle
        private set

    @Column(name = "display_name", nullable = false, length = 40)
    var displayName: String = displayName
        private set

    @Column(length = 300)
    var bio: String? = bio
        private set

    @Column(name = "avatar_url", length = 1000)
    var avatarUrl: String? = avatarUrl
        private set

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    var role: ProfileRole = role
        private set

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    var status: ProfileStatus = status
        private set

    @Column(name = "approved_at")
    var approvedAt: LocalDateTime? = null
        private set

    @Column(name = "approved_by_member_id")
    var approvedByMemberId: Long? = null
        private set

    @Column(name = "created_at", insertable = false, updatable = false)
    var createdAt: LocalDateTime? = null
        private set

    @Column(name = "updated_at", insertable = false, updatable = false)
    var updatedAt: LocalDateTime? = null
        private set

    /** 본인이 고치는 값만. 역할·상태는 어드민 경로로만 바뀐다 */
    fun updateProfile(displayName: String, bio: String?, avatarUrl: String?) {
        this.displayName = displayName
        this.bio = bio
        this.avatarUrl = avatarUrl
    }

    /** 저자 신청 — 승인 전까지 핸들을 선점해 둔다(중복 신청·핸들 경합 방지) */
    fun applyAsAuthor(handle: String) {
        this.handle = handle
        role = ProfileRole.AUTHOR
        status = ProfileStatus.PENDING
    }

    fun approve(approverMemberId: Long, at: LocalDateTime) {
        role = ProfileRole.AUTHOR
        status = ProfileStatus.ACTIVE
        approvedAt = at
        approvedByMemberId = approverMemberId
    }

    fun changeStatus(status: ProfileStatus) {
        this.status = status
    }

    /** 도메인이 정한 값의 반영 — 승인 시각·승인자는 도메인 approve() 가 채운 값 그대로 */
    fun applyFrom(profile: BlogProfile) {
        handle = profile.handle
        displayName = profile.displayName
        bio = profile.bio
        avatarUrl = profile.avatarUrl
        role = profile.role
        status = profile.status
        approvedAt = profile.approvedAt
        approvedByMemberId = profile.approvedByMemberId
    }

    fun toDomain() = BlogProfile(
        id = id,
        memberId = memberId,
        handle = handle,
        displayName = displayName,
        bio = bio,
        avatarUrl = avatarUrl,
        role = role,
        status = status,
        approvedAt = approvedAt,
        approvedByMemberId = approvedByMemberId,
        createdAt = createdAt,
    )

    companion object {
        fun fromDomain(profile: BlogProfile) = BlogProfileJpaEntity(
            id = profile.id,
            memberId = profile.memberId,
            handle = profile.handle,
            displayName = profile.displayName,
            bio = profile.bio,
            avatarUrl = profile.avatarUrl,
            role = profile.role,
            status = profile.status,
        ).also { it.applyFrom(profile) }
    }
}
