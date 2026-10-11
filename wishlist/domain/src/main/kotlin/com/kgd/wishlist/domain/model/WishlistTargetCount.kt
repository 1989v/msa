package com.kgd.wishlist.domain.model

/** 대상 하나를 찜한 회원 수 — 대상 기준 집계라 회원 id·시각을 담지 않는다. */
data class WishlistTargetCount(val targetKey: String, val count: Long)
