package com.kgd.blog.infrastructure.persistence.entity

import com.kgd.blog.domain.model.BlogComment
import com.kgd.blog.domain.model.CommentStatus
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
@Table(name = "blog_comment")
class BlogCommentJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "post_id", nullable = false)
    val postId: Long = 0,

    @Column(name = "profile_id", nullable = false)
    val profileId: Long = 0,

    @Column(name = "parent_id")
    val parentId: Long? = null,

    body: String = "",
    status: CommentStatus = CommentStatus.VISIBLE,
) {
    @Column(nullable = false, length = 2000)
    var body: String = body
        private set

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    var status: CommentStatus = status
        private set

    @Column(name = "created_at", insertable = false, updatable = false)
    var createdAt: LocalDateTime? = null
        private set

    @Column(name = "updated_at", insertable = false, updatable = false)
    var updatedAt: LocalDateTime? = null
        private set

    fun edit(body: String) {
        this.body = body
    }

    /**
     * 소프트 삭제. 행은 남기고 본문만 비운다 — 행을 지우면 대댓글이 부모를 잃고,
     * 본문을 남기면 "삭제했다"는 사용자의 의사가 지켜지지 않는다.
     */
    fun softDelete() {
        status = CommentStatus.DELETED
        body = BlogComment.DELETED_PLACEHOLDER
    }

    fun changeStatus(status: CommentStatus) {
        this.status = status
    }

    fun toDomain() = BlogComment(
        id = id,
        postId = postId,
        profileId = profileId,
        parentId = parentId,
        body = body,
        status = status,
    )
}
