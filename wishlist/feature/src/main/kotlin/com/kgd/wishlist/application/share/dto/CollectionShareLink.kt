package com.kgd.wishlist.application.share.dto

import java.time.Instant

/** 소유자가 보는 공유 링크. [url] 은 단축 주소 `/c/{token}` 이다 */
data class CollectionShareLink(
    val token: String,
    val url: String,
    /** null 이면 만료 없음 */
    val expiresAt: Instant?,
)
