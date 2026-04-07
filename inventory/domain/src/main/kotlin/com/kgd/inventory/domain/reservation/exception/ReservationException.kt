package com.kgd.inventory.domain.reservation.exception

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.inventory.domain.reservation.model.ReservationStatus

class InvalidReservationStateException(currentStatus: ReservationStatus, action: String) :
    BusinessException(ErrorCode.INVALID_INPUT, "예약 상태 전이 불가: $currentStatus → $action")
