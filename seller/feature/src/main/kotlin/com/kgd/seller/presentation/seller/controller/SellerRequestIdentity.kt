package com.kgd.seller.presentation.seller.controller

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.common.exception.ForbiddenException
import com.kgd.common.exception.UnauthorizedException
import com.kgd.common.response.ApiResponse
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity

/**
 * 게이트웨이가 채운 신원 헤더 해석. 헤더가 없으면 허용으로 떨어지지 않고 401 이다.
 * 역할은 게이트웨이가 먼저 보지만 서비스도 다시 본다(라우트 설정 실수가 곧 권한 우회가 되지 않게).
 */
internal object SellerRequestIdentity {
    fun requireUser(userId: String?): String =
        userId?.trim()?.takeIf { it.isNotEmpty() } ?: throw UnauthorizedException("X-User-Id 가 없습니다")

    fun requireAdmin(userId: String?, roles: String?): String {
        val id = requireUser(userId)
        val granted = roles.orEmpty().split(',').map { it.trim() }
        if ("ROLE_ADMIN" !in granted) throw ForbiddenException("ROLE_ADMIN 이 필요합니다")
        return id
    }
}

/**
 * seller 컨트롤러의 BusinessException → HTTP 상태.
 *
 * 컨트롤러 안의 `@ExceptionHandler` 로 둔다. commerce 에는 범위 없는 HIGHEST_PRECEDENCE advice 가 둘
 * (Product·OrderExceptionHandler) 있어 어느 쪽이 이길지 정해져 있지 않고, 둘 다 409·400 을 500 으로 낸다.
 * 컨트롤러 로컬 핸들러는 모든 advice 보다 먼저 적용된다.
 */
internal object SellerErrorResponses {
    fun of(e: BusinessException): ResponseEntity<ApiResponse<Nothing>> {
        val status = when (e.errorCode) {
            ErrorCode.NOT_FOUND -> HttpStatus.NOT_FOUND
            ErrorCode.UNAUTHORIZED -> HttpStatus.UNAUTHORIZED
            ErrorCode.FORBIDDEN -> HttpStatus.FORBIDDEN
            ErrorCode.DUPLICATE_RESOURCE, ErrorCode.INVALID_SELLER_STATUS -> HttpStatus.CONFLICT
            ErrorCode.INVALID_INPUT -> HttpStatus.BAD_REQUEST
            else -> HttpStatus.INTERNAL_SERVER_ERROR
        }
        return ResponseEntity.status(status).body(ApiResponse.error(e.errorCode))
    }
}
