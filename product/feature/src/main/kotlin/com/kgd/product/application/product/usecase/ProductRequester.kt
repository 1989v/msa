package com.kgd.product.application.product.usecase

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode

/**
 * 상품 쓰기 요청자 — 게이트웨이가 JWT 를 검증하고 주입한 `X-User-Id` · `X-User-Roles` 에서 온다.
 * 게이트웨이는 클라이언트가 붙인 같은 이름의 헤더를 덮어쓰거나 지운다.
 */
data class ProductRequester(val userId: String, val roles: Set<String>) {
    val isAdmin: Boolean get() = ROLE_ADMIN in roles
    val isSeller: Boolean get() = ROLE_SELLER in roles

    companion object {
        const val ROLE_ADMIN = "ROLE_ADMIN"
        const val ROLE_SELLER = "ROLE_SELLER"

        /** 신원 헤더가 없으면 거부한다 — 익명으로 떨어뜨려 허용하지 않는다. */
        fun of(userId: String?, roles: String?): ProductRequester {
            if (userId.isNullOrBlank()) throw BusinessException(ErrorCode.UNAUTHORIZED, "요청자 신원이 없습니다")
            val roleSet = roles.orEmpty().split(',').map { it.trim() }.filter { it.isNotEmpty() }.toSet()
            return ProductRequester(userId, roleSet)
        }
    }
}
