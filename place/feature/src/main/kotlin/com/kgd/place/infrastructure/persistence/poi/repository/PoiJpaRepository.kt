package com.kgd.place.infrastructure.persistence.poi.repository

import com.kgd.place.infrastructure.persistence.poi.entity.PoiJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface PoiJpaRepository : JpaRepository<PoiJpaEntity, Long>
