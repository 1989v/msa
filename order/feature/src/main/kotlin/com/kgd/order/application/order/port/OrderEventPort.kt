package com.kgd.order.application.order.port

import com.kgd.order.domain.order.model.Order

interface OrderEventPort {
    fun publishOrderCompleted(order: Order)
    fun publishOrderCancelled(order: Order)
}
