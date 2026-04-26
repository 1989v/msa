package com.kgd.sevensplit.domain.exception

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode

/**
 * SplitStrategy 설정값이 도메인 불변식(INV-07)을 위반했을 때.
 *
 * TODO: ErrorCode.SEVEN_SPLIT_CONFIG_INVALID 를 common 모듈에 추가하고 교체.
 *       현재는 INVALID_INPUT 으로 대체한다.
 */
class SplitStrategyConfigInvalidException(
    message: String
) : BusinessException(errorCode = ErrorCode.INVALID_INPUT, message = message)
