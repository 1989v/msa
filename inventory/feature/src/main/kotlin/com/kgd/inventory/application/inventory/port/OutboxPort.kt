package com.kgd.inventory.application.inventory.port

interface OutboxPort {
    fun save(aggregateType: String, aggregateId: Long, eventType: String, payload: String)
}
