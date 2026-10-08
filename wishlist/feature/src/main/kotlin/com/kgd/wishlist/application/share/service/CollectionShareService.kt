package com.kgd.wishlist.application.share.service

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.common.shortlink.ShortLinkProperties
import com.kgd.wishlist.application.share.config.WishlistShareProperties
import com.kgd.wishlist.application.share.dto.CollectionShareLink
import com.kgd.wishlist.application.share.dto.SharedCollection
import com.kgd.wishlist.application.share.port.CollectionSharePort
import com.kgd.wishlist.application.share.usecase.GetSharedCollectionUseCase
import com.kgd.wishlist.application.share.usecase.ManageCollectionShareUseCase
import com.kgd.wishlist.application.share.usecase.ResolveCollectionShortLinkUseCase
import com.kgd.wishlist.domain.model.CollectionShare
import com.kgd.wishlist.domain.model.WishlistCollection
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock

/**
 * 묶음 공유 (ADR-0107).
 *
 * 모든 메서드는 첫 줄에서 설정 꺼짐을 본다 — 꺼짐 404 가 없는 토큰의 404 와 같아야 하고,
 * 범위 검사(400)보다 먼저여야 꺼진 기능의 존재가 드러나지 않는다.
 * 404 는 전부 기본 메시지 하나로 낸다. 메시지가 갈리면 없음·남의 것·만료가 구분된다.
 */
@Service
@Transactional
@Qualifier("wishlistTransactionManager")
class CollectionShareService(
    private val port: CollectionSharePort,
    private val shareProperties: WishlistShareProperties,
    private val shortLinkProperties: ShortLinkProperties,
    @Qualifier("wishlistClock") private val clock: Clock,
) : ManageCollectionShareUseCase,
    GetSharedCollectionUseCase,
    ResolveCollectionShortLinkUseCase {

    override fun create(memberId: Long, collectionId: Long, expiresInDays: Int?): CollectionShareLink {
        requireEnabled()
        if (expiresInDays != null &&
            expiresInDays !in CollectionShare.MIN_EXPIRES_IN_DAYS..CollectionShare.MAX_EXPIRES_IN_DAYS
        ) {
            throw BusinessException(
                ErrorCode.INVALID_INPUT,
                "만료 일수는 ${CollectionShare.MIN_EXPIRES_IN_DAYS}~${CollectionShare.MAX_EXPIRES_IN_DAYS} 사이여야 합니다",
            )
        }
        // 묶음 행을 잠가 동시 생성이 둘 다 살아남지 못하게 한다 — 스키마가 이걸 강제하지 못한다
        port.lockOwnedCollection(collectionId, memberId) ?: throw notFound()
        val now = clock.instant()
        port.findUnrevokedByCollection(collectionId).forEach {
            it.revoke(now)
            port.save(it)
        }
        return port.save(CollectionShare.create(collectionId, memberId, expiresInDays, clock)).toLink()
    }

    @Transactional(readOnly = true)
    override fun get(memberId: Long, collectionId: Long): CollectionShareLink? {
        requireEnabled()
        port.findOwnedCollection(collectionId, memberId) ?: throw notFound()
        val now = clock.instant()
        return port.findUnrevokedByCollection(collectionId)
            .filter { it.isAlive(now) }
            .maxByOrNull { it.createdAt }
            ?.toLink()
    }

    override fun revoke(memberId: Long, collectionId: Long) {
        requireEnabled()
        port.lockOwnedCollection(collectionId, memberId) ?: throw notFound()
        val now = clock.instant()
        port.findUnrevokedByCollection(collectionId).forEach {
            it.revoke(now)
            port.save(it)
        }
    }

    @Transactional(readOnly = true)
    override fun get(token: String): SharedCollection {
        requireEnabled()
        if (!CollectionShare.TOKEN_PATTERN.matches(token)) throw notFound()
        val share = port.findByToken(token)?.takeIf { it.isAlive(clock.instant()) } ?: throw notFound()
        val collection: WishlistCollection = port.findCollection(share.collectionId) ?: throw notFound()
        val items = port.findAttractionItems(share.collectionId, MAX_SHARED_ITEMS + 1)
        return SharedCollection(
            name = collection.name,
            items = items.take(MAX_SHARED_ITEMS).map { SharedCollection.Item(it.targetType, it.targetKey) },
            truncated = items.size > MAX_SHARED_ITEMS,
        )
    }

    /** DB 를 보지 않는다. 형식이 틀려도 404 가 아니라 수신 화면의 「찾을 수 없는 링크」로 보낸다 */
    @Transactional(readOnly = true)
    override fun resolve(rest: String): String {
        requireEnabled()
        val target = if (CollectionShare.TOKEN_PATTERN.matches(rest)) rest else INVALID_TARGET
        return "${shortLinkProperties.origin}$SHARED_PATH$target"
    }

    private fun requireEnabled() {
        if (!shareProperties.enabled) throw notFound()
    }

    private fun notFound() = BusinessException(ErrorCode.NOT_FOUND)

    private fun CollectionShare.toLink() = CollectionShareLink(
        token = token,
        url = "${shortLinkProperties.origin}$SHORT_PATH$token",
        expiresAt = expiresAt,
    )

    companion object {
        const val MAX_SHARED_ITEMS = 100
        private const val SHORT_PATH = "/c/"
        private const val SHARED_PATH = "/shared/"
        private const val INVALID_TARGET = "invalid"
    }
}
