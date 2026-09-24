package com.kgd.order.domain.sheet.exception

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.order.domain.sheet.model.OrderSheetRejection

/** 주문서 생성·사용 거부(422) — 이유는 [rejection] */
class OrderSheetUnavailableException(val rejection: OrderSheetRejection) :
    BusinessException(ErrorCode.ORDER_SHEET_UNAVAILABLE, "주문서를 만들거나 쓸 수 없습니다: $rejection")

/** 없는 주문서와 남의 주문서는 같은 404 — 존재 여부를 흘리지 않는다 */
class OrderSheetNotFoundException(id: Long) : BusinessException(ErrorCode.NOT_FOUND, "주문서(id=$id)를 찾을 수 없습니다")
