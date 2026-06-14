package com.kgd.place.domain.region.exception

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode

class RegionNotFoundException(id: Long) : BusinessException(ErrorCode.NOT_FOUND, "지역을 찾을 수 없습니다: id=$id")
