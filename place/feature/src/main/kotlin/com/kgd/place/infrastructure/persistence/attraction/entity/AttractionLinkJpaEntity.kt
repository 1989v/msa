package com.kgd.place.infrastructure.persistence.attraction.entity

import com.kgd.place.domain.attraction.model.AttractionLink
import com.kgd.place.domain.attraction.model.AttractionLinkSource
import com.kgd.place.domain.attraction.model.VideoFormat
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
@Table(name = "attraction_links")
class AttractionLinkJpaEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "attraction_id", nullable = false)
    val attractionId: Long,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    val source: AttractionLinkSource,

    @Column(name = "external_id", nullable = false, length = 100)
    val externalId: String,

    @Column(nullable = false, length = 300)
    val title: String,

    @Column(nullable = false, length = 500)
    val url: String,

    @Column(name = "thumbnail_url", length = 500)
    val thumbnailUrl: String? = null,

    @Column(length = 100)
    val author: String? = null,

    @Column(name = "published_at")
    val publishedAt: LocalDateTime? = null,

    @Column(name = "view_count")
    val viewCount: Long? = null,

    @Column(length = 32)
    val duration: String? = null,

    @Column(name = "embed_width")
    val embedWidth: Int? = null,

    @Column(name = "embed_height")
    val embedHeight: Int? = null,

    /** 파생 — 원천 값에서 도메인이 판정한 것을 운영 조회용으로 남긴다. 읽을 때는 도메인이 다시 판정한다 */
    @Enumerated(EnumType.STRING)
    @Column(name = "video_format", length = 10)
    val videoFormat: VideoFormat? = null,

    @Column(name = "sort_order", nullable = false)
    val sortOrder: Int = 0,

    @Column(name = "collected_at", nullable = false)
    val collectedAt: LocalDateTime,
) {
    fun toDomain(): AttractionLink = AttractionLink.restore(
        id = id,
        attractionId = attractionId,
        source = source,
        externalId = externalId,
        title = title,
        url = url,
        thumbnailUrl = thumbnailUrl,
        author = author,
        publishedAt = publishedAt,
        viewCount = viewCount,
        duration = duration,
        embedWidth = embedWidth,
        embedHeight = embedHeight,
        sortOrder = sortOrder,
        collectedAt = collectedAt,
    )

    companion object {
        fun fromDomain(link: AttractionLink) = AttractionLinkJpaEntity(
            id = link.id,
            attractionId = link.attractionId,
            source = link.source,
            externalId = link.externalId,
            title = link.title,
            url = link.url,
            thumbnailUrl = link.thumbnailUrl,
            author = link.author,
            publishedAt = link.publishedAt,
            viewCount = link.viewCount,
            duration = link.duration,
            embedWidth = link.embedWidth,
            embedHeight = link.embedHeight,
            videoFormat = link.format,
            sortOrder = link.sortOrder,
            collectedAt = link.collectedAt,
        )
    }
}
