package com.kgd.product.domain.product.exception

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode

class ProductNotFoundException(id: Long) : BusinessException(ErrorCode.NOT_FOUND, "상품(id=$id)을 찾을 수 없습니다")
class InsufficientStockException : BusinessException(ErrorCode.INSUFFICIENT_STOCK)
class InvalidProductStatusException : BusinessException(ErrorCode.INVALID_PRODUCT_STATUS)
