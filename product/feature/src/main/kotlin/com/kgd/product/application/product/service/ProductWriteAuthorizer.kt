package com.kgd.product.application.product.service

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.product.application.product.usecase.ProductRequester
import com.kgd.product.application.seller.port.ProductSellerRepositoryPort
import com.kgd.product.domain.product.model.Product
import com.kgd.product.domain.seller.model.ProductSeller
import org.springframework.stereotype.Component

/**
 * 상품 쓰기 권한 — 게이트웨이가 ROLE_SELLER|ROLE_ADMIN 으로 좁힌 요청을 서비스가 다시 판정한다.
 *
 * 판매자는 토큰의 ROLE_SELLER 와 판매자 읽기 모델의 **ACTIVE 행**(memberId == X-User-Id)을 둘 다 가져야
 * 한다. 행은 매 요청 읽으므로 정지는 토큰 만료를 기다리지 않고 바로 막힌다 (ADR-0099 §8).
 */
@Component
class ProductWriteAuthorizer(
    private val sellers: ProductSellerRepositoryPort,
) {

    /**
     * 등록 권한을 판정하고 **상품이 속할 판매자 id** 를 돌려준다. 소유자는 요청 본문이 아니라 여기서만 정해진다.
     * ACTIVE 판매자면 그 판매자, 판매자 행이 없는 어드민이면 플랫폼 기본 판매자다.
     */
    fun authorizeCreate(requester: ProductRequester): Long {
        activeSellerOf(requester)?.let { return it.sellerId }
        if (requester.isAdmin) return Product.PLATFORM_SELLER_ID
        throw forbidden(requester)
    }

    /** 어드민은 모든 상품, 판매자는 자기 상품만 */
    fun authorizeUpdate(requester: ProductRequester, product: Product) {
        if (requester.isAdmin) return
        val seller = activeSellerOf(requester) ?: throw forbidden(requester)
        if (seller.sellerId != product.sellerId) throw forbidden(requester)
    }

    private fun activeSellerOf(requester: ProductRequester): ProductSeller? =
        if (requester.isSeller) sellers.findActiveByMemberId(requester.userId) else null

    private fun forbidden(requester: ProductRequester) =
        BusinessException(ErrorCode.FORBIDDEN, "상품을 쓸 권한이 없습니다: userId=${requester.userId}")
}
