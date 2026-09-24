package com.kgd.promotion.domain.point.exception

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode

/** 잔액보다 많이 쓰려 한다 — 잔액은 0 아래로 내려가지 않는다 */
class InsufficientPointsException(balance: Long, requested: Long) :
    BusinessException(ErrorCode.INSUFFICIENT_POINTS, "포인트 잔액 ${balance} 보다 많이 쓸 수 없습니다 (요청 $requested)")
