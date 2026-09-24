package com.kgd.order.presentation.support

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.common.response.ApiResponse
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity

/** 클레임·구매 확정의 상태 충돌(INVALID_ORDER_STATUS)은 409 — 나머지는 주문 컨트롤러와 같은 표 */
internal object ClaimErrorResponses {
    fun of(e: BusinessException): ResponseEntity<ApiResponse<Nothing>> =
        if (e.errorCode == ErrorCode.INVALID_ORDER_STATUS) {
            ResponseEntity.status(HttpStatus.CONFLICT).body(ApiResponse.error(e.errorCode.name, e.message ?: e.errorCode.message))
        } else {
            OrderSheetErrorResponses.of(e)
        }
}
