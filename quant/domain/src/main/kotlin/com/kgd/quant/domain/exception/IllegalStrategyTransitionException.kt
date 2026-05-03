package com.kgd.quant.domain.exception

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode

/**
 * StrategyStatus / StrategyRunStatus 상태 전이 가드를 위반했을 때.
 *
 * TODO: ErrorCode.QUANT_ILLEGAL_STRATEGY_TRANSITION 를 common 모듈에 추가.
 */
class IllegalStrategyTransitionException(
    message: String
) : BusinessException(errorCode = ErrorCode.INVALID_ORDER_STATUS, message = message)
