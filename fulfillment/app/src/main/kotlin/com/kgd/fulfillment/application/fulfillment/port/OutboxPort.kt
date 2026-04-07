package com.kgd.fulfillment.application.fulfillment.port

interface OutboxPort {
    fun save(aggregateType: String, aggregateId: Long, eventType: String, payload: String)
}
