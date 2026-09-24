package com.kgd.payment.domain.payment.exception

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.payment.domain.payment.model.PaymentStatus

class InvalidPaymentStateException(current: PaymentStatus, action: String) :
    BusinessException(ErrorCode.INVALID_PAYMENT_STATUS, "결제 상태 전이 불가: $current → $action")

/** 환불 합은 매입액을 넘을 수 없다 */
class RefundExceedsCapturedException(requested: Long, refundable: Long) :
    BusinessException(ErrorCode.INVALID_INPUT, "환불 요청 ${requested}원이 환불 가능액 ${refundable}원을 넘습니다")

/** 같은 가맹점 주문번호에 다른 주문·금액이 오면 계약 위반이다 — 새 승인을 만들지 않는다 */
class OrderNoConflictException(orderNo: String) :
    BusinessException(ErrorCode.DUPLICATE_RESOURCE, "같은 주문번호에 다른 주문·금액이 왔습니다 (orderNo=$orderNo)")
