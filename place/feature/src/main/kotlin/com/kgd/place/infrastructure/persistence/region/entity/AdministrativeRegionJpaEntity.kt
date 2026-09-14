package com.kgd.place.infrastructure.persistence.region.entity

import com.kgd.place.domain.region.model.AdministrativeRegion
import com.kgd.place.domain.region.model.AdministrativeRegionLevel
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Id
import jakarta.persistence.Table

@Entity
@Table(name = "administrative_regions")
class AdministrativeRegionJpaEntity(
    @Id
    @Column(length = 5)
    val code: String,

    @Column(name = "parent_code", length = 5)
    val parentCode: String? = null,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    val level: AdministrativeRegionLevel,

    @Column(nullable = false, length = 60)
    val name: String,

    @Column(name = "name_en", length = 80)
    val nameEn: String? = null,

    val latitude: Double? = null,

    val longitude: Double? = null,
) {
    fun toDomain(): AdministrativeRegion = AdministrativeRegion.restore(
        code = code,
        parentCode = parentCode,
        level = level,
        name = name,
        nameEn = nameEn,
        latitude = latitude,
        longitude = longitude,
    )

    companion object {
        fun fromDomain(region: AdministrativeRegion) = AdministrativeRegionJpaEntity(
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
