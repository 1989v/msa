package com.kgd.inventory.application.ownership.service

import com.kgd.common.exception.ForbiddenException
import com.kgd.inventory.application.ownership.port.OwnershipRepositoryPort
import com.kgd.inventory.application.ownership.usecase.AuthorizeInventoryAccessUseCase
import com.kgd.inventory.application.ownership.usecase.InventoryRequester
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional

/**
 * 재고 REST 권한 — 게이트웨이는 ROLE_SELLER|ROLE_ADMIN 까지만 본다. 여기서 소유를 다시 판정한다.
 *
 * 어드민은 전부. 판매자는 토큰의 ROLE_SELLER 와 **ACTIVE 판매자 행**(memberId == X-User-Id)을 둘 다 가져야 하고,
 * 대상 상품이 전부 그 판매자 것이어야 한다. 소유를 모르는 상품(읽기 모델에 행이 없다)은 거부한다 — 모르면 막는다.
 */
@Component
class InventoryAccessAuthorizer(
    private val ownership: OwnershipRepositoryPort,
) : AuthorizeInventoryAccessUseCase {

    @Transactional(transactionManager = "inventoryTransactionManager", readOnly = true)
    override fun requireProductAccess(requester: InventoryRequester, productIds: Collection<Long>) {
        if (requester.isAdmin) return
        val seller = (if (requester.isSeller) ownership.findActiveSellerByMemberId(requester.userId) else null)
            ?: throw forbidden(requester, productIds)
        val owners = ownership.findProductOwners(productIds.toSet()).associate { it.productId to it.sellerId }
        if (productIds.any { owners[it] != seller.sellerId }) throw forbidden(requester, productIds)
    }

    private fun forbidden(requester: InventoryRequester, productIds: Collection<Long>) =
        ForbiddenException("이 상품의 재고를 다룰 권한이 없습니다: userId=${requester.userId}, productIds=$productIds")
}
