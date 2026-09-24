package com.kgd.product.application.product.usecase

/**
 * 모든 상품의 현재 상태를 `product.item.updated` 로 다시 낸다(아웃박스 행). 어드민 전용.
 *
 * 이벤트는 변경 때만 나가므로, 새 구독자(order 읽기 모델)는 그 전에 만들어진 상품을 모른다 — 배포 뒤 한 번 돌린다.
 * 여러 번 돌려도 안전하다: 구독자는 상품 id 로 덮어쓰고 이벤트 id 로 중복을 거른다.
 */
interface RepublishProductsUseCase {
    /** @return 발행한 상품 수 */
    fun execute(requester: ProductRequester): Int
}
