package com.kgd.wishlist.infrastructure.persistence.adapter

import com.kgd.wishlist.application.wishlist.port.WishlistRepositoryPort
import com.kgd.wishlist.domain.model.WishlistCollection
import com.kgd.wishlist.domain.model.WishlistItem
import com.kgd.wishlist.domain.model.WishlistTargetType
import com.kgd.wishlist.infrastructure.persistence.entity.WishlistCollectionJpaEntity
import com.kgd.wishlist.infrastructure.persistence.entity.WishlistItemJpaEntity
import com.kgd.wishlist.infrastructure.persistence.repository.WishlistCollectionJpaRepository
import com.kgd.wishlist.infrastructure.persistence.repository.WishlistItemJpaRepository
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.stereotype.Component

@Component
class WishlistRepositoryAdapter(
    private val wishlistItemJpaRepository: WishlistItemJpaRepository,
    private val collectionJpaRepository: WishlistCollectionJpaRepository,
) : WishlistRepositoryPort {

    override fun countByTarget(targetType: WishlistTargetType, targetKey: String): Long =
        wishlistItemJpaRepository.countByTargetTypeAndTargetKey(targetType, targetKey)

    override fun save(item: WishlistItem): WishlistItem {
        val entity = WishlistItemJpaEntity.fromDomain(item)
        return wishlistItemJpaRepository.save(entity).toDomain()
    }

    override fun findByMemberAndTarget(
        memberId: Long,
        targetType: WishlistTargetType,
        targetKey: String,
    ): WishlistItem? =
        wishlistItemJpaRepository.findByMemberIdAndTargetTypeAndTargetKey(memberId, targetType, targetKey)?.toDomain()

    override fun deleteByMemberAndTarget(memberId: Long, targetType: WishlistTargetType, targetKey: String) {
        wishlistItemJpaRepository.deleteByMemberIdAndTargetTypeAndTargetKey(memberId, targetType, targetKey)
    }

    override fun findByMember(
        memberId: Long,
        targetType: WishlistTargetType?,
        collectionId: Long?,
        unclassifiedOnly: Boolean,
        page: Int,
        size: Int,
    ): List<WishlistItem> =
        wishlistItemJpaRepository
            .search(
                memberId,
                targetType,
                collectionId,
                unclassifiedOnly,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")),
            )
            .map { it.toDomain() }

    override fun countByMember(
        memberId: Long,
        targetType: WishlistTargetType?,
        collectionId: Long?,
        unclassifiedOnly: Boolean,
    ): Long = wishlistItemJpaRepository.countSearch(memberId, targetType, collectionId, unclassifiedOnly)

    override fun findKeysByMemberAndType(memberId: Long, targetType: WishlistTargetType): List<String> =
        wishlistItemJpaRepository.findKeysByMemberIdAndTargetType(memberId, targetType)

    override fun deleteAllByMemberId(memberId: Long) {
        wishlistItemJpaRepository.deleteAllByMemberId(memberId)
    }

    override fun deleteAllByTarget(targetType: WishlistTargetType, targetKey: String) {
        wishlistItemJpaRepository.deleteAllByTarget(targetType, targetKey)
    }

    // ── 묶음 (ADR-0080) ───────────────────────────────────────────────────────

    override fun saveCollection(collection: WishlistCollection): WishlistCollection {
        // 개명은 기존 행을 찾아 이름만 바꾼다 — fromDomain 으로 새 엔티티를 만들면
        // createdAt 이 갱신되어 목록 순서가 흔들린다
        val existing = collection.id?.let { collectionJpaRepository.findByIdAndMemberId(it, collection.memberId) }
        if (existing != null) {
            existing.rename(collection.name)
            return collectionJpaRepository.save(existing).toDomain()
        }
        return collectionJpaRepository.save(WishlistCollectionJpaEntity.fromDomain(collection)).toDomain()
    }

    override fun findCollections(memberId: Long): List<WishlistCollection> =
        collectionJpaRepository.findAllByMemberIdOrderByCreatedAtAsc(memberId).map { it.toDomain() }

    override fun findCollection(id: Long, memberId: Long): WishlistCollection? =
        collectionJpaRepository.findByIdAndMemberId(id, memberId)?.toDomain()

    override fun deleteCollection(id: Long, memberId: Long) {
        // FK 가 ON DELETE SET NULL 이라 소속 찜은 미분류로 남는다 (ADR-0080)
        collectionJpaRepository.findByIdAndMemberId(id, memberId)?.let { collectionJpaRepository.delete(it) }
    }

    override fun countByCollection(memberId: Long): Map<Long, Long> =
        wishlistItemJpaRepository.countGroupedByCollection(memberId).associate { row ->
            (row[0] as Number).toLong() to (row[1] as Number).toLong()
        }
}
