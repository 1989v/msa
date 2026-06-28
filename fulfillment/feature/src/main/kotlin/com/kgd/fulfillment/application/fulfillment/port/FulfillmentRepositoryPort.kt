package com.kgd.fulfillment.application.fulfillment.port

import com.kgd.fulfillment.domain.fulfillment.model.FulfillmentOrder

interface FulfillmentRepositoryPort {
    fun save(fulfillmentOrder: FulfillmentOrder): FulfillmentOrder
    fun findById(id: Long): FulfillmentOrder?
    fun findAllByOrderId(orderId: Long): List<FulfillmentOrder>
    fun findByOrderIdAndWarehouseId(orderId: Long, warehouseId: Long): FulfillmentOrder?
}
