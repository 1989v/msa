package com.kgd.place.domain.attraction.exception

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode

class AttractionNotFoundException(id: Long) :
    BusinessException(ErrorCode.NOT_FOUND, "관광지를 찾을 수 없습니다: id=$id")
