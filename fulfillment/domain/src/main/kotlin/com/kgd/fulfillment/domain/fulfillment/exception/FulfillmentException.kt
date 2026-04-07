package com.kgd.fulfillment.domain.fulfillment.exception

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.fulfillment.domain.fulfillment.model.FulfillmentStatus

class InvalidFulfillmentStateException(currentStatus: FulfillmentStatus, targetStatus: FulfillmentStatus) :
    BusinessException(ErrorCode.INVALID_FULFILLMENT_STATUS, "풀필먼트 상태 전이 불가: $currentStatus → $targetStatus")

class FulfillmentNotFoundException(id: Long) :
    BusinessException(ErrorCode.NOT_FOUND, "풀필먼트를 찾을 수 없습니다: id=$id")
