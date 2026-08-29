package com.kgd.wishlist.application.wishlist.usecase

import com.kgd.wishlist.domain.model.WishlistTargetType

/**
 * 이 대상을 찜한 사람 수 — **로그인 없이도 볼 수 있는 공개 수치**다.
 *
 * 게임 상세가 "좋아요" 자리에 쓴다. 좋아요를 따로 만들지 않는 것은 둘 다
 * "이 게임을 아껴 둔 사람" 을 뜻하는데, 표를 나누면 어느 쪽도 안 쌓이기 때문이다.
 */
interface CountWishlistTargetUseCase {
    fun execute(query: Query): Long

    data class Query(val targetType: WishlistTargetType, val targetKey: String)
}
