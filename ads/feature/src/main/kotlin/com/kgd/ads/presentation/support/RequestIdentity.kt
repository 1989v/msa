package com.kgd.ads.presentation.support

import com.kgd.common.exception.ForbiddenException
import com.kgd.common.exception.UnauthorizedException

/**
 * 게이트웨이가 넣는 신원 헤더 읽기. 게이트웨이의 인증 필터가 클라이언트가 보낸 `X-User-Id`·`X-User-Roles` 를 지우고
 * 토큰에서 채우므로 여기 오는 값만 믿는다. 게이트웨이가 이미 막지만(광고주 경로 401, 어드민 경로 ROLE_ADMIN)
 * 게이트웨이를 거치지 않은 호출에도 같은 답을 주도록 다시 확인한다.
 */
internal object RequestIdentity {
    const val USER_HEADER = "X-User-Id"
    const val ROLES_HEADER = "X-User-Roles"
    private const val ADMIN_ROLE = "ROLE_ADMIN"

    fun member(userId: String?): Long =
        userId?.trim()?.toLongOrNull() ?: throw UnauthorizedException()

    /** 어드민 요청의 행위자(운영자 회원 id). */
    fun admin(userId: String?, roles: String?): Long {
        val memberId = member(userId)
        if (roles?.split(',')?.none { it.trim() == ADMIN_ROLE } != false) throw ForbiddenException()
        return memberId
    }
}
