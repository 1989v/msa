package com.kgd.wishlist.application.wishlist.usecase

import com.kgd.wishlist.domain.model.WishlistTargetType

/** 목록 화면의 "찜됨" 하이드레이션용 — 타입 하나의 내 찜 키만 싸게 내린다 (ADR-0074 §2). */
interface GetWishlistKeysUseCase {
    fun execute(query: Query): Result

    data class Query(val memberId: Long, val targetType: WishlistTargetType)

    data class Result(val keys: List<String>)
}
