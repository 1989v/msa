package com.kgd.order.application.sheet.port

import com.kgd.order.domain.sheet.model.OrderSheet

interface OrderSheetRepositoryPort {
    fun save(sheet: OrderSheet): OrderSheet
    fun findById(id: Long): OrderSheet?
}
