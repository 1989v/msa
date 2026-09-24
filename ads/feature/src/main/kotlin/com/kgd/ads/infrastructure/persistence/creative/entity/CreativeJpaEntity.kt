package com.kgd.ads.infrastructure.persistence.creative.entity

import com.kgd.ads.domain.advertiser.model.AdvertiserKind
import com.kgd.ads.domain.creative.model.Creative
import com.kgd.ads.domain.creative.model.CreativeContent
import com.kgd.ads.domain.creative.model.HouseCreativeContent
import com.kgd.ads.domain.creative.model.HouseLink
import com.kgd.ads.domain.creative.model.LandingUrl
import com.kgd.ads.domain.creative.model.PaidCreativeContent
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
 * 종류로 가른다 — 그래서 도메인 내용([CreativeContent])으로 바꿀 때 광고주 종류를 받는다.
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
) {
    /** [kind] 는 소유 광고주 종류 — MEMBER 면 링크가 랜딩 URL, SYSTEM 이면 HOUSE 링크다. 규칙을 어긴 행은 예외. */
    fun toDomain(kind: AdvertiserKind): Creative {
        val content: CreativeContent = when (kind) {
            AdvertiserKind.MEMBER -> PaidCreativeContent(title, body, LandingUrl.of(linkUrl), requireNotNull(imageHash) { "유료 소재에 이미지가 없습니다" })
            AdvertiserKind.SYSTEM -> HouseCreativeContent(title, body, emoji, HouseLink.of(linkUrl), imageHash)
        }
        return Creative.restore(requireNotNull(id), campaignId, advertiserId, content, status, rejectReason, reviewedBy, reviewedAt)
    }

    companion object {
        /** 도메인 값 전부를 행으로 — 새 소재면 id 가 null 이다. */
        fun of(creative: Creative, createdAt: LocalDateTime, now: LocalDateTime): CreativeJpaEntity {
            val (link, emoji) = when (val c = creative.content) {
                is PaidCreativeContent -> c.landingUrl.value to null
                is HouseCreativeContent -> c.link.value to c.emoji
            }
            return CreativeJpaEntity(
                id = creative.id,
                campaignId = creative.campaignId,
                advertiserId = creative.advertiserId,
                title = creative.content.title,
                body = creative.content.body,
                linkUrl = link,
                emoji = emoji,
                imageHash = creative.content.imageHash,
                status = creative.status,
                rejectReason = creative.rejectReason,
                reviewedBy = creative.reviewedBy,
                reviewedAt = creative.reviewedAt,
                createdAt = createdAt,
                updatedAt = now,
            )
        }
    }
}
