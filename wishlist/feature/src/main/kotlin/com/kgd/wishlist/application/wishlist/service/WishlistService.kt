package com.kgd.wishlist.application.wishlist.service

import com.kgd.wishlist.application.wishlist.port.WishlistRepositoryPort
import com.kgd.wishlist.application.wishlist.usecase.AddWishlistItemUseCase
import com.kgd.wishlist.application.wishlist.usecase.GetWishlistKeysUseCase
import com.kgd.wishlist.application.wishlist.usecase.GetWishlistUseCase
import com.kgd.wishlist.application.wishlist.usecase.RemoveWishlistItemUseCase
import com.kgd.wishlist.domain.model.WishlistItem
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class WishlistService(
    private val wishlistRepositoryPort: WishlistRepositoryPort
) : AddWishlistItemUseCase, RemoveWishlistItemUseCase, GetWishlistUseCase, GetWishlistKeysUseCase {

    // PUT 멱등 — 이미 찜한 대상이면 그 행을 돌려준다. 더블탭·재시도가 에러가 되지 않는다 (ADR-0074 §2).
    @Transactional("wishlistTransactionManager")
    override fun execute(command: AddWishlistItemUseCase.Command): AddWishlistItemUseCase.Result {
        val existing = wishlistRepositoryPort.findByMemberAndTarget(
            command.memberId, command.targetType, command.targetKey,
        )
        val item = existing ?: wishlistRepositoryPort.save(
            WishlistItem.create(
                memberId = command.memberId,
                targetType = command.targetType,
                targetKey = command.targetKey,
            )
        )

        return AddWishlistItemUseCase.Result(
            id = requireNotNull(item.id),
            targetType = item.targetType,
            targetKey = item.targetKey,
            createdAt = item.createdAt,
        )
    }

    @Transactional("wishlistTransactionManager")
    override fun execute(command: RemoveWishlistItemUseCase.Command) {
        wishlistRepositoryPort.deleteByMemberAndTarget(command.memberId, command.targetType, command.targetKey)
    }

    @Transactional("wishlistTransactionManager", readOnly = true)
    override fun execute(query: GetWishlistUseCase.Query): GetWishlistUseCase.Result {
        val items = wishlistRepositoryPort.findByMember(query.memberId, query.targetType, query.page, query.size)
        val totalCount = wishlistRepositoryPort.countByMember(query.memberId, query.targetType)

        return GetWishlistUseCase.Result(
            items = items.map {
                GetWishlistUseCase.Result.Item(
                    id = requireNotNull(it.id),
                    targetType = it.targetType,
                    targetKey = it.targetKey,
                    createdAt = it.createdAt
                )
            },
            totalCount = totalCount
        )
    }

    @Transactional("wishlistTransactionManager", readOnly = true)
    override fun execute(query: GetWishlistKeysUseCase.Query): GetWishlistKeysUseCase.Result {
        val keys = wishlistRepositoryPort.findKeysByMemberAndType(query.memberId, query.targetType)
        return GetWishlistKeysUseCase.Result(keys = keys)
    }
}
