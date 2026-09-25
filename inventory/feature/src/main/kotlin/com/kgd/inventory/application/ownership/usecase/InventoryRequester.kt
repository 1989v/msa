package com.kgd.inventory.application.ownership.usecase

import com.kgd.common.exception.UnauthorizedException

/**
 * 재고 REST 요청자 — 게이트웨이가 JWT 를 검증하고 주입한 `X-User-Id` · `X-User-Roles` 에서 온다.
 * 게이트웨이는 클라이언트가 붙인 같은 이름의 헤더를 지운다.
 */
data class InventoryRequester(val userId: String, val roles: Set<String>) {
    val isAdmin: Boolean get() = ROLE_ADMIN in roles
    val isSeller: Boolean get() = ROLE_SELLER in roles

    companion object {
        const val ROLE_ADMIN = "ROLE_ADMIN"
        const val ROLE_SELLER = "ROLE_SELLER"

        /** 신원 헤더가 없으면 401 — 익명으로 떨어뜨려 허용하지 않는다 */
        fun of(userId: String?, roles: String?): InventoryRequester {
            val id = userId?.trim()?.takeIf { it.isNotEmpty() } ?: throw UnauthorizedException("요청자 신원이 없습니다")
            val roleSet = roles.orEmpty().split(',').map { it.trim() }.filter { it.isNotEmpty() }.toSet()
            return InventoryRequester(id, roleSet)
        }
    }
}
