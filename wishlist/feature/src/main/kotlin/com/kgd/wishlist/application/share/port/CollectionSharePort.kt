package com.kgd.wishlist.application.share.port

import com.kgd.wishlist.domain.model.CollectionShare
import com.kgd.wishlist.domain.model.WishlistCollection
import com.kgd.wishlist.domain.model.WishlistItem

/**
 * 묶음 공유 저장소 (ADR-0107).
 *
 * 「살아 있는 링크는 묶음당 하나」를 스키마가 강제하지 못한다(MySQL 에 부분 유일 인덱스가 없다).
 * 그래서 생성은 [lockOwnedCollection] 으로 묶음 행을 잡은 뒤 폐기 → 삽입한다.
 */
interface CollectionSharePort {
    /** 소유 묶음을 쓰기 잠금으로 읽는다. 없거나 남의 묶음이면 null — 둘을 가르지 않는다 */
    fun lockOwnedCollection(collectionId: Long, memberId: Long): WishlistCollection?

    /** 소유 묶음을 잠금 없이 읽는다. 없거나 남의 묶음이면 null */
    fun findOwnedCollection(collectionId: Long, memberId: Long): WishlistCollection?

    /** 공개 열람용 — 토큰이 가리키는 묶음. 소유자 조건이 없다 */
    fun findCollection(collectionId: Long): WishlistCollection?

    /** 폐기되지 않은 행. 만료 여부는 보지 않는다(만료 판정은 도메인이 열람 시점에 한다) */
    fun findUnrevokedByCollection(collectionId: Long): List<CollectionShare>

    /** id 가 없으면 삽입, 있으면 폐기 시각을 반영한다 */
    fun save(share: CollectionShare): CollectionShare

    fun findByToken(token: String): CollectionShare?

    /** 묶음의 관광지 항목만, 찜한 시각 내림차순으로 [limit] 건까지 */
    fun findAttractionItems(collectionId: Long, limit: Int): List<WishlistItem>

    /** 탈퇴 — 그 회원의 공유 행을 지운다 */
    fun deleteAllByMemberId(memberId: Long)
}
