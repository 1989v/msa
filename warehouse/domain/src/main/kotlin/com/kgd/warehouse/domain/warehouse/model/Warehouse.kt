package com.kgd.warehouse.domain.warehouse.model

import java.time.LocalDateTime

class Warehouse private constructor(
    val id: Long? = null,
    var name: String,
    var address: String,
    var latitude: Double,
    var longitude: Double,
    var active: Boolean,
    val createdAt: LocalDateTime = LocalDateTime.now(),
) {
    companion object {
        fun create(name: String, address: String, latitude: Double, longitude: Double): Warehouse {
            require(name.isNotBlank()) { "창고명은 비어있을 수 없습니다" }
            return Warehouse(name = name, address = address, latitude = latitude, longitude = longitude, active = true)
        }

        fun restore(
            id: Long?,
            name: String,
            address: String,
            latitude: Double,
            longitude: Double,
            active: Boolean,
            createdAt: LocalDateTime,
        ): Warehouse =
            Warehouse(id = id, name = name, address = address, latitude = latitude, longitude = longitude, active = active, createdAt = createdAt)
    }

    fun deactivate() {
        check(active) { "이미 비활성 상태인 창고입니다" }
        active = false
    }

    fun activate() {
        check(!active) { "이미 활성 상태인 창고입니다" }
        active = true
    }
}
