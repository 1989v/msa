package com.kgd.blog.infrastructure.persistence.entity

import com.kgd.blog.domain.model.VoterKey
import com.kgd.blog.domain.model.VoterType
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDate
import java.time.LocalDateTime

/**
 * 조회 원장 — 조회수의 진실은 여기고 `blog_post.view_count` 는 파생값이다.
 *
 * `(post_id, visitor_key, view_date)` UNIQUE 가 하루 1회로 접는다. Redis 를 쓰지 않은 이유는
 * 호스트 앱에 Redis 의존성이 없고, 부수적으로 날짜별 추이가 남아 작성자 통계가 되기 때문이다.
 */
@Entity
@Table(name = "blog_post_view")
class BlogPostViewJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "post_id", nullable = false)
    val postId: Long = 0,

    @Column(name = "visitor_key", nullable = false, length = 64)
    val visitorKey: String = "",

    @Column(name = "view_date", nullable = false)
    val viewDate: LocalDate = LocalDate.EPOCH,
) {
    @Column(name = "created_at", insertable = false, updatable = false)
    var createdAt: LocalDateTime? = null
        private set
}

@Entity
@Table(name = "blog_post_like")
class BlogPostLikeJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "post_id", nullable = false)
    val postId: Long = 0,

    @Enumerated(EnumType.STRING)
    @Column(name = "voter_type", nullable = false, length = 8)
    val voterType: VoterType = VoterType.VISITOR,

    @Column(name = "voter_key", nullable = false, length = 64)
    val voterKey: String = "",
) {
    @Column(name = "created_at", insertable = false, updatable = false)
    var createdAt: LocalDateTime? = null
        private set

    constructor(postId: Long, voter: VoterKey) : this(
        id = null,
        postId = postId,
        voterType = voter.voterType,
        voterKey = voter.key,
    )
}

@Entity
@Table(name = "blog_post_rating")
class BlogPostRatingJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "post_id", nullable = false)
    val postId: Long = 0,

    @Enumerated(EnumType.STRING)
    @Column(name = "voter_type", nullable = false, length = 8)
    val voterType: VoterType = VoterType.VISITOR,

    @Column(name = "voter_key", nullable = false, length = 64)
    val voterKey: String = "",

    score: Int = 0,
) {
    @Column(nullable = false)
    var score: Int = score
        private set

    @Column(name = "created_at", insertable = false, updatable = false)
    var createdAt: LocalDateTime? = null
        private set

    @Column(name = "updated_at", insertable = false, updatable = false)
    var updatedAt: LocalDateTime? = null
        private set

    constructor(postId: Long, voter: VoterKey, score: Int) : this(
        id = null,
        postId = postId,
        voterType = voter.voterType,
        voterKey = voter.key,
        score = score,
    )

    /** 재평가 — 새 행을 만들면 1인 1표가 깨진다 */
    fun rescore(score: Int) {
        this.score = score
    }
}
