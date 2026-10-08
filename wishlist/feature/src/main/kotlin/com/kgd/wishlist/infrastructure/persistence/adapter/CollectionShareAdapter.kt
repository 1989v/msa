package com.kgd.wishlist.infrastructure.persistence.adapter

import com.kgd.wishlist.application.share.port.CollectionSharePort
import com.kgd.wishlist.domain.model.CollectionShare
import com.kgd.wishlist.domain.model.WishlistCollection
import com.kgd.wishlist.domain.model.WishlistItem
import com.kgd.wishlist.domain.model.WishlistTargetType
import com.kgd.wishlist.infrastructure.persistence.entity.CollectionShareJpaEntity
import com.kgd.wishlist.infrastructure.persistence.repository.CollectionShareJpaRepository
import com.kgd.wishlist.infrastructure.persistence.repository.WishlistCollectionJpaRepository
import com.kgd.wishlist.infrastructure.persistence.repository.WishlistItemJpaRepository
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.stereotype.Component

@Component
class CollectionShareAdapter(
    private val shareJpaRepository: CollectionShareJpaRepository,
    private val collectionJpaRepository: WishlistCollectionJpaRepository,
    private val itemJpaRepository: WishlistItemJpaRepository,
) : CollectionSharePort {

    override fun lockOwnedCollection(collectionId: Long, memberId: Long): WishlistCollection? =
        collectionJpaRepository.findForUpdateByIdAndMemberId(collectionId, memberId)?.toDomain()

    override fun findOwnedCollection(collectionId: Long, memberId: Long): WishlistCollection? =
        collectionJpaRepository.findByIdAndMemberId(collectionId, memberId)?.toDomain()

    override fun findCollection(collectionId: Long): WishlistCollection? =
        collectionJpaRepository.findById(collectionId).orElse(null)?.toDomain()

    override fun findUnrevokedByCollection(collectionId: Long): List<CollectionShare> =
        shareJpaRepository.findAllByCollectionIdAndRevokedAtIsNull(collectionId).map { it.toDomain() }

    override fun save(share: CollectionShare): CollectionShare {
        // 기존 행은 폐기 시각만 바꾼다 — 나머지 컬럼은 만든 뒤 바뀌지 않는다
        val existing = share.id?.let { shareJpaRepository.findById(it).orElse(null) }
        if (existing != null) {
            share.revokedAt?.let(existing::revoke)
            return shareJpaRepository.save(existing).toDomain()
        }
        return shareJpaRepository.save(CollectionShareJpaEntity.fromDomain(share)).toDomain()
    }

    override fun findByToken(token: String): CollectionShare? =
        shareJpaRepository.findByToken(token)?.toDomain()

    override fun findAttractionItems(collectionId: Long, limit: Int): List<WishlistItem> =
        itemJpaRepository
            .findAllByCollectionIdAndTargetType(
                collectionId,
                WishlistTargetType.ATTRACTION,
                // 같은 시각에 찜한 항목이 있어도 순서가 흔들리지 않게 id 로 한 번 더 정렬한다
                PageRequest.of(0, limit, Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"))),
            )
            .map { it.toDomain() }

    override fun deleteAllByMemberId(memberId: Long) {
        shareJpaRepository.deleteAllByMemberId(memberId)
    }
}
