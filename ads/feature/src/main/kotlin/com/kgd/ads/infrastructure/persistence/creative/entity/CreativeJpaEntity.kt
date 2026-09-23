package com.kgd.ads.infrastructure.persistence.creative.entity

import com.kgd.ads.domain.creative.model.CreativeContent
import com.kgd.ads.domain.creative.model.CreativeRejectReason
import com.kgd.ads.domain.creative.model.CreativeStatus
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
 * 소재 행. 링크는 한 컬럼(`link_url`)이고 유료(랜딩 URL)인지 HOUSE(앱 안 경로 허용)인지는 소유 캠페인의
 * 종류로 가른다 — 그래서 도메인 내용([CreativeContent])으로 바꾸는 일은 광고주 종류를 아는 어댑터가 한다.
 */
@Entity
@Table(name = "ad_creative")
class CreativeJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "campaign_id", nullable = false)
    val campaignId: Long,

    @Column(name = "advertiser_id", nullable = false)
    val advertiserId: Long,

    @Column(name = "title", nullable = false, length = 40)
    val title: String,

    @Column(name = "body", nullable = false, length = 90)
    val body: String,

    @Column(name = "link_url", nullable = false, length = 2048)
    val linkUrl: String,

    @Column(name = "emoji", length = 16)
    val emoji: String?,

    @Column(name = "image_hash", columnDefinition = "CHAR(64)")
    val imageHash: String?,

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    val status: CreativeStatus,

    @Enumerated(EnumType.STRING)
    @Column(name = "reject_reason", length = 32)
    val rejectReason: CreativeRejectReason?,

    @Column(name = "reviewed_by")
    val reviewedBy: Long?,

    @Column(name = "reviewed_at")
    val reviewedAt: LocalDateTime?,

    @Column(name = "created_at", nullable = false)
    val createdAt: LocalDateTime,

    @Column(name = "updated_at", nullable = false)
    val updatedAt: LocalDateTime,
)
