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
    /** 인기 신호. `search.list` 는 관련성 순이라 이것 없이는 "인기 영상"이 아니다. */
    val viewCount: Long? = null,
    /** 원천 길이 원문(ISO-8601, `PT58S`). 영상만 — 형태 판정의 근거라 원문으로 둔다. */
    val duration: String? = null,
    /** 원천 플레이어 크기(`player.embedWidth/Height`). 비율만 의미가 있다. */
    val embedWidth: Int? = null,
    val embedHeight: Int? = null,
    val sortOrder: Int = 0,
    val collectedAt: LocalDateTime = LocalDateTime.now(),
) {
    /** 원천 값에서 파생한 형태. 모르면 null. */
    val format: VideoFormat? get() = VideoFormat.classify(duration, embedWidth, embedHeight)

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
            viewCount: Long? = null,
            duration: String? = null,
            embedWidth: Int? = null,
            embedHeight: Int? = null,
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
                viewCount = viewCount?.takeIf { it >= 0 },
                duration = duration?.takeIf { it.isNotBlank() },
                embedWidth = embedWidth,
                embedHeight = embedHeight,
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
            viewCount: Long?,
            duration: String?,
            embedWidth: Int?,
            embedHeight: Int?,
            sortOrder: Int,
            collectedAt: LocalDateTime,
        ) = AttractionLink(
            id, attractionId, source, externalId, title, url,
            thumbnailUrl, author, publishedAt, viewCount, duration, embedWidth, embedHeight, sortOrder, collectedAt,
        )
    }
}
