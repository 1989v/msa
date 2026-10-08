package com.kgd.wishlist.application.share.usecase

import com.kgd.wishlist.application.share.dto.SharedCollection

/**
 * 토큰으로 묶음을 연다 — 로그인 없음 (ADR-0107 §2).
 *
 * 없음·폐기·만료·형식 오류·설정 꺼짐은 모두 같은 NOT_FOUND 다.
 */
interface GetSharedCollectionUseCase {
    fun get(token: String): SharedCollection
}
