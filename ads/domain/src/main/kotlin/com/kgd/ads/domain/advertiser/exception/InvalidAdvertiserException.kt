package com.kgd.ads.domain.advertiser.exception

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode

class InvalidAdvertiserException(message: String) : BusinessException(ErrorCode.INVALID_INPUT, message)
