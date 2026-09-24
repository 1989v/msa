package com.kgd.order.domain.saga.exception

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode

class InvalidSagaTransitionException(detail: String) :
    BusinessException(ErrorCode.INVALID_SAGA_STATUS, "유효하지 않은 사가 전이: $detail")
