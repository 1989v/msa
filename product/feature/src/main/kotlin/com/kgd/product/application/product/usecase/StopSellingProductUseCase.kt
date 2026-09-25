package com.kgd.product.application.product.usecase

/**
 * 판매 중지 — 어드민 전용. 행을 지우지 않고 INACTIVE 로 바꾸고 `product.item.updated` 를 낸다.
 * 주문·정산·클레임이 상품 id 를 계속 참조하므로 물리 삭제는 하지 않는다. 이미 중지된 상품이면 그대로 돌려준다.
 */
interface StopSellingProductUseCase {
    fun execute(id: Long, requester: ProductRequester): UpdateProductUseCase.Result
}
