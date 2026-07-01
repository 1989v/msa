package com.kgd.wishlist.infrastructure.persistence.adapter

import com.kgd.wishlist.application.wishlist.port.WishlistRepositoryPort
import com.kgd.wishlist.domain.model.WishlistItem
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

    override fun deleteByMemberIdAndProductId(memberId: Long, productId: Long) {
        wishlistItemJpaRepository.deleteByMemberIdAndProductId(memberId, productId)
    }

    override fun findByMemberId(memberId: Long, page: Int, size: Int): List<WishlistItem> {
        val pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"))
        return wishlistItemJpaRepository.findByMemberId(memberId, pageable).map { it.toDomain() }
    }

    override fun countByMemberId(memberId: Long): Long {
        return wishlistItemJpaRepository.countByMemberId(memberId)
    }

    override fun existsByMemberIdAndProductId(memberId: Long, productId: Long): Boolean {
        return wishlistItemJpaRepository.existsByMemberIdAndProductId(memberId, productId)
    }

    override fun deleteAllByMemberId(memberId: Long) {
        wishlistItemJpaRepository.deleteAllByMemberId(memberId)
    }

    override fun deleteAllByProductId(productId: Long) {
        wishlistItemJpaRepository.deleteAllByProductId(productId)
    }
}
