package com.kgd.wishlist.application.wishlist.service

import com.kgd.wishlist.application.wishlist.port.WishlistRepositoryPort
import com.kgd.wishlist.application.wishlist.usecase.AddWishlistItemUseCase
import com.kgd.wishlist.application.wishlist.usecase.GetWishlistKeysUseCase
import com.kgd.wishlist.application.wishlist.usecase.GetWishlistUseCase
import com.kgd.wishlist.application.wishlist.usecase.ManageCollectionUseCase
import com.kgd.wishlist.application.wishlist.usecase.RemoveWishlistItemUseCase
import com.kgd.wishlist.domain.model.WishlistCollection
import com.kgd.wishlist.domain.model.WishlistItem
import com.kgd.wishlist.domain.model.WishlistTargetType
import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class WishlistService(
    private val wishlistRepositoryPort: WishlistRepositoryPort
) : AddWishlistItemUseCase,
    RemoveWishlistItemUseCase,
    GetWishlistUseCase,
    GetWishlistKeysUseCase,
    ManageCollectionUseCase {

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
        val items = wishlistRepositoryPort.findByMember(
            query.memberId, query.targetType, query.collectionId, query.unclassifiedOnly, query.page, query.size,
        )
        val totalCount = wishlistRepositoryPort.countByMember(
            query.memberId, query.targetType, query.collectionId, query.unclassifiedOnly,
        )

        return GetWishlistUseCase.Result(
            items = items.map {
                GetWishlistUseCase.Result.Item(
                    id = requireNotNull(it.id),
                    targetType = it.targetType,
                    targetKey = it.targetKey,
                    collectionId = it.collectionId,
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

    // ── 묶음 (ADR-0080) ───────────────────────────────────────────────────────

    @Transactional("wishlistTransactionManager")
    override fun create(memberId: Long, name: String): ManageCollectionUseCase.Collection {
        val saved = wishlistRepositoryPort.saveCollection(WishlistCollection.create(memberId, name))
        return saved.toResult(itemCount = 0)
    }

    @Transactional("wishlistTransactionManager")
    override fun rename(memberId: Long, collectionId: Long, name: String): ManageCollectionUseCase.Collection {
        val collection = ownedCollection(memberId, collectionId)
        collection.rename(name)
        val saved = wishlistRepositoryPort.saveCollection(collection)
        return saved.toResult(itemCount = wishlistRepositoryPort.countByCollection(memberId)[collectionId] ?: 0)
    }

    @Transactional("wishlistTransactionManager")
    override fun delete(memberId: Long, collectionId: Long) {
        // 없어도 조용히 끝낸다 — 삭제는 멱등이어야 재시도가 에러가 되지 않는다
        wishlistRepositoryPort.deleteCollection(collectionId, memberId)
    }

    @Transactional("wishlistTransactionManager", readOnly = true)
    override fun list(memberId: Long): List<ManageCollectionUseCase.Collection> {
        val counts = wishlistRepositoryPort.countByCollection(memberId)
        return wishlistRepositoryPort.findCollections(memberId)
            .map { it.toResult(itemCount = counts[it.id] ?: 0) }
    }

    @Transactional("wishlistTransactionManager")
    override fun move(
        memberId: Long,
        targetType: WishlistTargetType,
        targetKey: String,
        collectionId: Long?,
    ) {
        // 남의 묶음으로 밀어넣지 못하게 소유를 먼저 확인한다 (null = 미분류로 빼기라 검증 대상 아님)
        if (collectionId != null) ownedCollection(memberId, collectionId)

        val item = wishlistRepositoryPort.findByMemberAndTarget(memberId, targetType, targetKey)
            ?: throw BusinessException(ErrorCode.NOT_FOUND, "찜하지 않은 대상입니다")
        item.moveTo(collectionId)
        wishlistRepositoryPort.save(item)
    }

    private fun ownedCollection(memberId: Long, collectionId: Long): WishlistCollection =
        wishlistRepositoryPort.findCollection(collectionId, memberId)
            ?: throw BusinessException(ErrorCode.NOT_FOUND, "묶음을 찾을 수 없습니다")

    private fun WishlistCollection.toResult(itemCount: Long) = ManageCollectionUseCase.Collection(
        id = requireNotNull(id),
        name = name,
        itemCount = itemCount,
        createdAt = createdAt,
    )
}
