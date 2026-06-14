package com.kgd.place.infrastructure.persistence.poi.entity

import com.kgd.place.domain.poi.model.Poi
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime

@Entity
@Table(name = "pois")
class PoiJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(nullable = false, length = 32)
    val source: String,

    @Column(nullable = false, length = 128)
    val sourceKey: String,

    @Column(nullable = false, length = 300)
    val name: String,

    @Column(length = 100)
    val categoryMajor: String? = null,

    @Column(length = 100)
    val categoryMid: String? = null,

    @Column(length = 100)
    val categorySub: String? = null,

    val regionId: Long? = null,

    @Column(length = 300)
    val roadAddress: String? = null,

    @Column(length = 300)
    val jibunAddress: String? = null,

    @Column(nullable = false)
    val latitude: Double,

    @Column(nullable = false)
    val longitude: Double,

    @Column(nullable = false, length = 20)
    val status: String,

    @Column(nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),
) {
    fun toDomain(): Poi = Poi.restore(
        id = id,
        source = source,
        sourceKey = sourceKey,
        name = name,
        categoryMajor = categoryMajor,
        categoryMid = categoryMid,
        categorySub = categorySub,
        regionId = regionId,
        roadAddress = roadAddress,
        jibunAddress = jibunAddress,
        latitude = latitude,
        longitude = longitude,
        status = status,
        createdAt = createdAt,
    )

    companion object {
        fun fromDomain(poi: Poi): PoiJpaEntity = PoiJpaEntity(
            id = poi.id,
            source = poi.source,
            sourceKey = poi.sourceKey,
            name = poi.name,
            categoryMajor = poi.categoryMajor,
            categoryMid = poi.categoryMid,
            categorySub = poi.categorySub,
            regionId = poi.regionId,
            roadAddress = poi.roadAddress,
            jibunAddress = poi.jibunAddress,
            latitude = poi.latitude,
            longitude = poi.longitude,
            status = poi.status,
            createdAt = poi.createdAt,
        )
    }
}
