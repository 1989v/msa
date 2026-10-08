package com.kgd.wishlist.application.share.usecase

import com.kgd.wishlist.application.share.dto.CollectionShareLink

/**
 * 묶음 공유 링크 관리 — 소유자 전용 (ADR-0107).
 *
 * 없는 묶음과 남의 묶음은 같은 NOT_FOUND 다(존재 은닉).
 */
interface ManageCollectionShareUseCase {
    /**
     * 새 링크를 만들고 이전 링크를 폐기한다.
     * @param expiresInDays null 이면 만료 없음. 1~365 밖이면 INVALID_INPUT
     */
    fun create(memberId: Long, collectionId: Long, expiresInDays: Int?): CollectionShareLink

    /** 살아 있는 링크. 없으면 null */
    fun get(memberId: Long, collectionId: Long): CollectionShareLink?

    /** 멱등 — 살아 있는 링크가 없어도 성공한다 */
    fun revoke(memberId: Long, collectionId: Long)
}
