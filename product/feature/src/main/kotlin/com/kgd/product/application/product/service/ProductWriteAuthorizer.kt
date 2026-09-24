package com.kgd.product.application.product.service

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.product.application.product.usecase.ProductRequester
import com.kgd.product.domain.product.model.Product
import org.springframework.stereotype.Component

/**
 * 상품 쓰기 권한 — 게이트웨이가 ROLE_SELLER|ROLE_ADMIN 으로 좁힌 요청을 서비스가 다시 판정한다.
 *
 * 규칙은 "그 상품의 ACTIVE 판매자 또는 어드민". 판매자 행이 아직 없어 판매자는 소유를 증명할 수 없으므로
 * 지금은 어드민만 통과한다. 판매자 소유 검사는 [authorizeUpdate] 의 [Product] 로 붙인다.
 */
@Component
class ProductWriteAuthorizer {

    fun authorizeCreate(requester: ProductRequester) = requireAdmin(requester)

    fun authorizeUpdate(requester: ProductRequester, @Suppress("UNUSED_PARAMETER") product: Product) =
        requireAdmin(requester)

    private fun requireAdmin(requester: ProductRequester) {
        if (!requester.isAdmin) {
            throw BusinessException(ErrorCode.FORBIDDEN, "상품을 쓸 권한이 없습니다: userId=${requester.userId}")
        }
    }
}
