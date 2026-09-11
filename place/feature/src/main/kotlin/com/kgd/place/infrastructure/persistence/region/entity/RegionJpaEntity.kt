package com.kgd.place.infrastructure.persistence.region.entity

import com.kgd.place.domain.region.model.Region
import com.kgd.place.domain.region.model.RegionLevel
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime

@Entity
@Table(name = "regions")
class RegionJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    val parentId: Long? = null,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    val level: RegionLevel,

    @Column(nullable = false, length = 200)
    val name: String,

    @Column(length = 200)
    val nameKo: String? = null,

    @Column(length = 2)
    val countryCode: String? = null,

    @Column(length = 20)
    val admin1Code: String? = null,

    @Column(length = 20)
    val admin2Code: String? = null,

    val geonamesId: Long? = null,

    val latitude: Double? = null,

    val longitude: Double? = null,

    val population: Long? = null,

    @Column(nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),
) {
    fun toDomain(): Region = Region.restore(
        id = id,
        parentId = parentId,
        level = level,
        name = name,
        nameKo = nameKo,
        countryCode = countryCode,
        admin1Code = admin1Code,
        admin2Code = admin2Code,
        geonamesId = geonamesId,
        latitude = latitude,
        longitude = longitude,
        population = population,
        createdAt = createdAt,
    )

    companion object {
        fun fromDomain(region: Region): RegionJpaEntity = RegionJpaEntity(
            id = region.id,
            parentId = region.parentId,
            level = region.level,
            name = region.name,
            nameKo = region.nameKo,
            countryCode = region.countryCode,
            admin1Code = region.admin1Code,
            admin2Code = region.admin2Code,
            geonamesId = region.geonamesId,
            latitude = region.latitude,
            longitude = region.longitude,
            population = region.population,
            createdAt = region.createdAt,
        )
    }
}
