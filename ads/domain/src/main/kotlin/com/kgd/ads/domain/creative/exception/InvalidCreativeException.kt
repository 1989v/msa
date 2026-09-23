package com.kgd.ads.domain.creative.exception

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode

class InvalidCreativeException(message: String) : BusinessException(ErrorCode.INVALID_INPUT, message)
