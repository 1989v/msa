package com.kgd.inventory.domain.inventory.exception

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode

class InsufficientStockException(productId: Long, warehouseId: Long, requestedQty: Int, availableQty: Int) :
    BusinessException(ErrorCode.INSUFFICIENT_STOCK, "재고 부족: productId=$productId, warehouseId=$warehouseId, 요청=$requestedQty, 가용=$availableQty")
