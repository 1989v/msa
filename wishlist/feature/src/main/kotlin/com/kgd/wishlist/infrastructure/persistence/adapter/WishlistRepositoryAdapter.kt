package com.kgd.wishlist.infrastructure.persistence.adapter

import com.kgd.wishlist.application.wishlist.port.WishlistRepositoryPort
import com.kgd.wishlist.domain.model.WishlistItem
import com.kgd.wishlist.domain.model.WishlistTargetType
import com.kgd.wishlist.infrastructure.persistence.entity.WishlistItemJpaEntity
import com.kgd.wishlist.infrastructure.persistence.repository.WishlistItemJpaRepository
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.stereotype.Component

@Component
class WishlistRepositoryAdapter(
    private val wishlistItemJpaRepository: WishlistItemJpaRepository
) : WishlistRepositoryPort {

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
        page: Int,
        size: Int,
    ): List<WishlistItem> {
        val pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"))
        val entities = if (targetType == null) {
            wishlistItemJpaRepository.findByMemberId(memberId, pageable)
        } else {
            wishlistItemJpaRepository.findByMemberIdAndTargetType(memberId, targetType, pageable)
        }
        return entities.map { it.toDomain() }
    }

    override fun countByMember(memberId: Long, targetType: WishlistTargetType?): Long =
        if (targetType == null) {
            wishlistItemJpaRepository.countByMemberId(memberId)
        } else {
            wishlistItemJpaRepository.countByMemberIdAndTargetType(memberId, targetType)
        }

    override fun findKeysByMemberAndType(memberId: Long, targetType: WishlistTargetType): List<String> =
        wishlistItemJpaRepository.findKeysByMemberIdAndTargetType(memberId, targetType)

    override fun deleteAllByMemberId(memberId: Long) {
        wishlistItemJpaRepository.deleteAllByMemberId(memberId)
    }

    override fun deleteAllByTarget(targetType: WishlistTargetType, targetKey: String) {
        wishlistItemJpaRepository.deleteAllByTarget(targetType, targetKey)
    }
}
