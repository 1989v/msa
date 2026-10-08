package com.kgd.wishlist.presentation.share.dto

import com.kgd.wishlist.application.share.dto.CollectionShareLink
import com.kgd.wishlist.application.share.dto.SharedCollection
import com.kgd.wishlist.domain.model.WishlistTargetType
import java.time.Instant

/**
 * 본문 없음과 `{}` 는 30일, 명시 `null` 은 만료 없음이다 — 셋을 가르는 것이 Kotlin 기본값이다.
 * Bean Validation 을 달지 않는다: 달면 설정 꺼짐 404 보다 400 이 먼저 난다. 범위 검사는 서비스가 한다.
 */
data class CreateCollectionShareRequest(val expiresInDays: Int? = 30)

data class CollectionShareResponse(
    val token: String,
    val url: String,
    /** null 이면 만료 없음 */
    val expiresAt: Instant?,
) {
    companion object {
        fun from(link: CollectionShareLink) = CollectionShareResponse(link.token, link.url, link.expiresAt)
    }
}

/** 링크가 없으면 404 가 아니라 `link: null` 이다 — 404 는 「공유 기능 없음」으로 읽힌다 */
data class CollectionShareStateResponse(val link: CollectionShareResponse?)

/** 공개 응답 — 소유자 식별 정보·시각을 싣지 않는다 (ADR-0107 §2) */
data class SharedCollectionResponse(
    val name: String,
    val items: List<Item>,
    val truncated: Boolean,
) {
    data class Item(val targetType: WishlistTargetType, val targetKey: String)

    companion object {
        fun from(shared: SharedCollection) = SharedCollectionResponse(
            name = shared.name,
            items = shared.items.map { Item(it.targetType, it.targetKey) },
            truncated = shared.truncated,
        )
    }
}
