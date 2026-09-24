package com.kgd.order.domain.claim.exception

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode

/** 409 — 지금 이 주문·라인은 클레임을 받을 수 없다(상태·이미 취소·진행 중 클레임) */
class ClaimNotAllowedException(detail: String) : BusinessException(ErrorCode.ORDER_CANCEL_NOT_ALLOWED, detail)

class ClaimNotFoundException(id: Long) : BusinessException(ErrorCode.NOT_FOUND, "클레임(id=$id)을 찾을 수 없습니다")

/** 상태 표에 없는 클레임 전이 */
class InvalidClaimTransitionException(detail: String) :
    BusinessException(ErrorCode.INVALID_ORDER_STATUS, "유효하지 않은 클레임 전이: $detail")

/** 409 — 구매 확정을 받을 수 없다(이행 전 · 진행 중 클레임 · 확정할 라인 없음) */
class PurchaseConfirmNotAllowedException(detail: String) : BusinessException(ErrorCode.INVALID_ORDER_STATUS, detail)
