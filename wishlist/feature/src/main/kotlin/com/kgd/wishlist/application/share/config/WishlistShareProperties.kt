package com.kgd.wishlist.application.share.config

import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * 묶음 공유 (ADR-0107). 꺼져 있으면 공유 경로 전부가 없는 토큰과 같은 404 를 낸다.
 * 컨트롤러는 항상 등록되고, 판정은 서비스 첫 줄이 한다.
 */
@ConfigurationProperties(prefix = "kgd.wishlist.share")
data class WishlistShareProperties(
    val enabled: Boolean = false,
)
