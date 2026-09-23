package com.kgd.ads.domain.placement.exception

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode

class InvalidPlacementException(message: String) : BusinessException(ErrorCode.INVALID_INPUT, message)
