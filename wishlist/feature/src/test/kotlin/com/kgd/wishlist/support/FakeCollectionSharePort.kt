package com.kgd.wishlist.support

import com.kgd.wishlist.application.share.port.CollectionSharePort
import com.kgd.wishlist.domain.model.CollectionShare
import com.kgd.wishlist.domain.model.WishlistCollection
import com.kgd.wishlist.domain.model.WishlistItem
import com.kgd.wishlist.domain.model.WishlistTargetType

/**
 * 컨트롤러·컨슈머 테스트용 저장소 대역. 정렬·잘라내기는 어댑터 몫이라 여기서는 포트 계약대로만 흉내 낸다 —
 * 실제 쿼리는 `WishlistSchemaIntegrationSpec` 이 MySQL 에서 본다.
 */
class FakeCollectionSharePort(
    val collections: MutableList<WishlistCollection> = mutableListOf(),
) : CollectionSharePort {
    val shares = mutableListOf<CollectionShare>()
    val items = mutableListOf<WishlistItem>()
    private var seq = 0L

    override fun lockOwnedCollection(collectionId: Long, memberId: Long) =
        findOwnedCollection(collectionId, memberId)

    override fun findOwnedCollection(collectionId: Long, memberId: Long) =
        collections.firstOrNull { it.id == collectionId && it.memberId == memberId }

    override fun findCollection(collectionId: Long) = collections.firstOrNull { it.id == collectionId }

    override fun findUnrevokedByCollection(collectionId: Long) =
        shares.filter { it.collectionId == collectionId && it.revokedAt == null }

    override fun save(share: CollectionShare): CollectionShare {
        if (share.id != null) {
            shares.replaceAll { if (it.id == share.id) share else it }
            return share
        }
        val saved = CollectionShare.restore(
            ++seq, share.collectionId, share.memberId, share.token, share.createdAt, share.expiresAt, share.revokedAt,
        )
        shares += saved
        return saved
    }

    override fun findByToken(token: String) = shares.firstOrNull { it.token == token }

    override fun findAttractionItems(collectionId: Long, limit: Int) = items
        .filter { it.collectionId == collectionId && it.targetType == WishlistTargetType.ATTRACTION }
        .sortedByDescending { it.createdAt }
        .take(limit)

    override fun deleteAllByMemberId(memberId: Long) {
        shares.removeIf { it.memberId == memberId }
    }
}
