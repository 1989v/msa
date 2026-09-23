package com.kgd.ads.domain.campaign.exception

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode

class InvalidCampaignException(message: String) : BusinessException(ErrorCode.INVALID_INPUT, message)
