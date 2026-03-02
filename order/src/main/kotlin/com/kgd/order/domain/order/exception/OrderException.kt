package com.kgd.order.domain.order.exception

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode

class OrderNotFoundException(id: Long) : BusinessException(ErrorCode.NOT_FOUND, "주문(id=$id)을 찾을 수 없습니다")
class InvalidOrderStatusException : BusinessException(ErrorCode.INVALID_ORDER_STATUS)
