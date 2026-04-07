package com.kgd.warehouse.domain.warehouse.exception

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode

class WarehouseNotFoundException(id: Long) : BusinessException(ErrorCode.NOT_FOUND, "창고를 찾을 수 없습니다: id=$id")

class NoActiveWarehouseException : BusinessException(ErrorCode.NOT_FOUND, "활성 상태의 창고가 없습니다")
