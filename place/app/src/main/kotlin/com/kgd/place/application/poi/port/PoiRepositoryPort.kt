package com.kgd.place.application.poi.port

import com.kgd.place.domain.poi.model.Poi

interface PoiRepositoryPort {
    fun save(poi: Poi): Poi
    fun saveAll(pois: List<Poi>): List<Poi>
    fun findById(id: Long): Poi?
    fun count(): Long
}
