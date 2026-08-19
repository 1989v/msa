package com.kgd.place.domain.attraction.model

import java.time.LocalDateTime

/** 수집형 링크의 원천. 딥링크(인스타·투어 상품)는 조립되는 값이라 여기 없다 (ADR-0070 §2). */
enum class AttractionLinkSource { YOUTUBE, NAVER_BLOG }

/**
 * 관광지에 붙는 수집형 외부 콘텐츠 (ADR-0070).
 *
 * 신선도는 이 행이 아니라 [AttractionLinkRequest.nextAttemptAt] 이 들고 있다 —
 * 만료를 양쪽에 두면 어느 쪽이 기준인지 알 수 없어진다.
 */
class AttractionLink private constructor(
    val id: Long? = null,
    val attractionId: Long,
    val source: AttractionLinkSource,
    val externalId: String,
    val title: String,
    val url: String,
    val thumbnailUrl: String? = null,
    val author: String? = null,
    val publishedAt: LocalDateTime? = null,
    val sortOrder: Int = 0,
    val collectedAt: LocalDateTime = LocalDateTime.now(),
) {
    companion object {
        @Suppress("LongParameterList")
        fun create(
            attractionId: Long,
            source: AttractionLinkSource,
            externalId: String,
            title: String,
            url: String,
            thumbnailUrl: String? = null,
            author: String? = null,
            publishedAt: LocalDateTime? = null,
            sortOrder: Int = 0,
            collectedAt: LocalDateTime = LocalDateTime.now(),
        ): AttractionLink {
            require(externalId.isNotBlank()) { "externalId 는 비어있을 수 없습니다" }
            require(title.isNotBlank()) { "제목은 비어있을 수 없습니다" }
            require(url.startsWith("https://")) { "링크는 https 여야 합니다: $url" }
            require(sortOrder >= 0) { "표시 순서는 0 이상이어야 합니다: $sortOrder" }
            return AttractionLink(
                attractionId = attractionId,
                source = source,
                externalId = externalId,
                title = title,
                url = url,
                thumbnailUrl = thumbnailUrl?.takeIf { it.isNotBlank() },
                author = author?.takeIf { it.isNotBlank() },
                publishedAt = publishedAt,
                sortOrder = sortOrder,
                collectedAt = collectedAt,
            )
        }

        @Suppress("LongParameterList")
        fun restore(
            id: Long?,
            attractionId: Long,
            source: AttractionLinkSource,
            externalId: String,
            title: String,
            url: String,
            thumbnailUrl: String?,
            author: String?,
            publishedAt: LocalDateTime?,
            sortOrder: Int,
            collectedAt: LocalDateTime,
        ) = AttractionLink(
            id, attractionId, source, externalId, title, url,
            thumbnailUrl, author, publishedAt, sortOrder, collectedAt,
        )
    }
}
