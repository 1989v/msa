package com.kgd.order.domain.order.exception

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode

class OrderNotFoundException(id: Long) : BusinessException(ErrorCode.NOT_FOUND, "주문(id=$id)을 찾을 수 없습니다")

/** 상태 표에 없는 전이 */
class InvalidOrderStatusException(detail: String) :
    BusinessException(ErrorCode.INVALID_ORDER_STATUS, "유효하지 않은 주문 상태 전이: $detail")

/** 409 — 결제 결과 확인 중이거나 결제 뒤(클레임으로 취소) */
class OrderCancelNotAllowedException(detail: String) : BusinessException(ErrorCode.ORDER_CANCEL_NOT_ALLOWED, detail)

/** 429 — 결제 대기(CREATED · PAYMENT_PENDING) 주문이 사용자당 상한에 닿았다 */
class TooManyPendingOrdersException(limit: Int) :
    BusinessException(ErrorCode.TOO_MANY_PENDING_ORDERS, "결제 대기 주문은 ${limit}건까지입니다")

/** 409 — 같은 Idempotency-Key 요청이 아직 처리 중(리스 유효) */
class IdempotencyKeyInProgressException : BusinessException(ErrorCode.IDEMPOTENCY_KEY_IN_PROGRESS)

/** 422 — 같은 Idempotency-Key 를 다른 요청 본문으로 다시 썼다(키를 새로 만들어야 한다) */
class IdempotencyKeyReusedException : BusinessException(ErrorCode.IDEMPOTENCY_KEY_REUSED)
