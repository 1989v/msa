package com.kgd.wishlist.application.wishlist.service

import com.kgd.wishlist.application.wishlist.port.WishlistRepositoryPort
import com.kgd.wishlist.application.wishlist.usecase.*
import com.kgd.wishlist.domain.exception.WishlistItemDuplicateException
import com.kgd.wishlist.domain.model.WishlistItem
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class WishlistService(
    private val wishlistRepositoryPort: WishlistRepositoryPort
) : AddWishlistItemUseCase, RemoveWishlistItemUseCase, GetWishlistUseCase,
    CheckWishlistItemUseCase, ClearWishlistUseCase {

    @Transactional
    override fun execute(command: AddWishlistItemUseCase.Command): AddWishlistItemUseCase.Result {
        if (wishlistRepositoryPort.existsByMemberIdAndProductId(command.memberId, command.productId)) {
            throw WishlistItemDuplicateException()
        }

        val item = WishlistItem.create(memberId = command.memberId, productId = command.productId)
        val saved = wishlistRepositoryPort.save(item)

        return AddWishlistItemUseCase.Result(
            id = requireNotNull(saved.id),
            productId = saved.productId
        )
    }

    @Transactional
    override fun execute(command: RemoveWishlistItemUseCase.Command) {
        wishlistRepositoryPort.deleteByMemberIdAndProductId(command.memberId, command.productId)
    }

    @Transactional(readOnly = true)
    override fun execute(query: GetWishlistUseCase.Query): GetWishlistUseCase.Result {
        val items = wishlistRepositoryPort.findByMemberId(query.memberId, query.page, query.size)
        val totalCount = wishlistRepositoryPort.countByMemberId(query.memberId)

        return GetWishlistUseCase.Result(
            items = items.map {
                GetWishlistUseCase.Result.Item(
                    id = requireNotNull(it.id),
                    productId = it.productId,
                    createdAt = it.createdAt
                )
            },
            totalCount = totalCount
        )
    }

    @Transactional(readOnly = true)
    override fun execute(query: CheckWishlistItemUseCase.Query): CheckWishlistItemUseCase.Result {
        val exists = wishlistRepositoryPort.existsByMemberIdAndProductId(query.memberId, query.productId)
        return CheckWishlistItemUseCase.Result(exists = exists)
    }

    @Transactional
    override fun execute(command: ClearWishlistUseCase.Command) {
        wishlistRepositoryPort.deleteAllByMemberId(command.memberId)
    }
}
