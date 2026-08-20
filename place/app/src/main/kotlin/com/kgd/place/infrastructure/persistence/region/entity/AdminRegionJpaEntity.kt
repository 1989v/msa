package com.kgd.place.infrastructure.persistence.region.entity

import com.kgd.place.domain.region.model.AdminRegion
import com.kgd.place.domain.region.model.AdminRegionLevel
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Id
import jakarta.persistence.Table

@Entity
@Table(name = "admin_regions")
class AdminRegionJpaEntity(
    @Id
    @Column(length = 5)
    val code: String,

    @Column(name = "parent_code", length = 5)
    val parentCode: String? = null,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    val level: AdminRegionLevel,

    @Column(nullable = false, length = 60)
    val name: String,

    @Column(name = "name_en", length = 80)
    val nameEn: String? = null,

    val latitude: Double? = null,

    val longitude: Double? = null,
) {
    fun toDomain(): AdminRegion = AdminRegion.restore(
        code = code,
        parentCode = parentCode,
        level = level,
        name = name,
        nameEn = nameEn,
        latitude = latitude,
        longitude = longitude,
    )

    companion object {
        fun fromDomain(region: AdminRegion) = AdminRegionJpaEntity(
            code = region.code,
            parentCode = region.parentCode,
            level = region.level,
            name = region.name,
            nameEn = region.nameEn,
            latitude = region.latitude,
            longitude = region.longitude,
        )
    }
}
