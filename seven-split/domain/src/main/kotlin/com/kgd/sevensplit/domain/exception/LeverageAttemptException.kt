package com.kgd.sevensplit.domain.exception

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode

/**
 * 레버리지/마진 주문 시도를 감지했을 때.
 *
 * - SpotOrderType 외 주문 타입이 도입되는 일은 컴파일 시점에 막히지만,
 *   exchange adapter에서 margin/future 엔드포인트를 우회 호출하는 경우 런타임 가드를 위해 존재.
 *
 * TODO: ErrorCode.SEVEN_SPLIT_LEVERAGE_ATTEMPT 를 common 모듈에 추가.
 */
class LeverageAttemptException(
    message: String
) : BusinessException(errorCode = ErrorCode.INVALID_INPUT, message = message)
