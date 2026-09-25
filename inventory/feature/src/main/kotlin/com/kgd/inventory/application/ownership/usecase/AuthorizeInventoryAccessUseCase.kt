package com.kgd.inventory.application.ownership.usecase

/** 재고 REST 권한 판정 — 어드민은 전부, 판매자는 ACTIVE 판매자 행 + 대상 상품 전부가 자기 것. 아니면 403 */
interface AuthorizeInventoryAccessUseCase {
    fun requireProductAccess(requester: InventoryRequester, productIds: Collection<Long>)
}
