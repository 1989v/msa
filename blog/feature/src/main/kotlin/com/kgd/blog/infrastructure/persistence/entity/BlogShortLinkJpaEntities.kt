package com.kgd.blog.infrastructure.persistence.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime

/** 단축 주소 클릭 원장. IP 는 두지 않는다 — 리퍼러 호스트와 UA 계열뿐이다. 보존 90일 (ADR-0077). */
@Entity
@Table(name = "blog_short_link_click")
class BlogShortLinkClickJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "post_id", nullable = false)
    val postId: Long = 0,

    @Column(name = "clicked_at", nullable = false)
    val clickedAt: LocalDateTime = LocalDateTime.now(),

    @Column(name = "referrer_host", length = 120)
    val referrerHost: String? = null,

    @Column(name = "ua_family", length = 40)
    val uaFamily: String? = null,
)

/** 글별 단축 주소 누적 클릭 수. 증가는 원자적 upsert 로만 한다(`BlogShortLinkStatJpaRepository`). */
@Entity
@Table(name = "blog_short_link_stat")
class BlogShortLinkStatJpaEntity(
    @Id
    @Column(name = "post_id")
    val postId: Long = 0,

    @Column(name = "click_count", nullable = false)
    val clickCount: Long = 0,
)
