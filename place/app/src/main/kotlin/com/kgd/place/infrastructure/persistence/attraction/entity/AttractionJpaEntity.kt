package com.kgd.place.infrastructure.persistence.attraction.entity

import com.kgd.place.domain.attraction.model.Attraction
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime

@Entity
@Table(name = "attractions")
class AttractionJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(nullable = false, length = 32)
    val contentId: String,

    @Column(nullable = false, length = 8)
    val lang: String,

    @Column(nullable = false, length = 300)
    val title: String,

    @Column(length = 300)
    val address: String? = null,

    @Column(length = 8)
    val areaCode: String? = null,

    @Column(length = 8)
    val sigunguCode: String? = null,

    @Column(length = 2)
    val ldongRegnCd: String? = null,

    @Column(length = 3)
    val ldongSignguCd: String? = null,

    @Column(length = 50)
    val category: String? = null,

    @Column(length = 16)
    val cat1: String? = null,

    @Column(length = 16)
    val cat2: String? = null,

    @Column(length = 16)
    val cat3: String? = null,

    @Column(name = "lcls_systm1", length = 4)
    val lclsSystm1: String? = null,

    @Column(name = "lcls_systm2", length = 8)
    val lclsSystm2: String? = null,

    @Column(name = "lcls_systm3", length = 16)
    val lclsSystm3: String? = null,

    @Column(name = "content_type_id", length = 8)
    val contentTypeId: String? = null,

    @Column(name = "copyright_div_cd", length = 8)
    val copyrightDivCd: String? = null,

    @Column(name = "thumbnail_url", length = 500)
    val thumbnailUrl: String? = null,

    @Column(name = "map_level")
    val mapLevel: Int? = null,

    @Column(name = "zipcode", length = 16)
    val zipcode: String? = null,

    @Column(name = "source_created_at")
    val sourceCreatedAt: LocalDateTime? = null,


    @Column(nullable = false)
    val latitude: Double,

    @Column(nullable = false)
    val longitude: Double,

    @Column(length = 500)
    val imageUrl: String? = null,

    @Column(length = 100)
    val tel: String? = null,

    @Column(columnDefinition = "TEXT")
    val overview: String? = null,

    val sourceModifiedAt: LocalDateTime? = null,

    @Column(nullable = false, length = 20)
    val status: String,

    @Column(nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),
) {
    fun toDomain(): Attraction = Attraction.restore(
        id = id,
        contentId = contentId,
        lang = lang,
        title = title,
        address = address,
        areaCode = areaCode,
        sigunguCode = sigunguCode,
        ldongRegnCd = ldongRegnCd,
        ldongSignguCd = ldongSignguCd,
        category = category,
        cat1 = cat1,
        cat2 = cat2,
        cat3 = cat3,
        lclsSystm1 = lclsSystm1,
        lclsSystm2 = lclsSystm2,
        lclsSystm3 = lclsSystm3,
        contentTypeId = contentTypeId,
        copyrightDivCd = copyrightDivCd,
        thumbnailUrl = thumbnailUrl,
        mapLevel = mapLevel,
        zipcode = zipcode,
        sourceCreatedAt = sourceCreatedAt,
        latitude = latitude,
        longitude = longitude,
        imageUrl = imageUrl,
        tel = tel,
        overview = overview,
        sourceModifiedAt = sourceModifiedAt,
        status = status,
        createdAt = createdAt,
    )

    companion object {
        fun fromDomain(attraction: Attraction): AttractionJpaEntity = AttractionJpaEntity(
            id = attraction.id,
            contentId = attraction.contentId,
            lang = attraction.lang,
            title = attraction.title,
            address = attraction.address,
            areaCode = attraction.areaCode,
            sigunguCode = attraction.sigunguCode,
            ldongRegnCd = attraction.ldongRegnCd,
            ldongSignguCd = attraction.ldongSignguCd,
            category = attraction.category,
            cat1 = attraction.cat1,
            cat2 = attraction.cat2,
            cat3 = attraction.cat3,
            lclsSystm1 = attraction.lclsSystm1,
            lclsSystm2 = attraction.lclsSystm2,
            lclsSystm3 = attraction.lclsSystm3,
            contentTypeId = attraction.contentTypeId,
            copyrightDivCd = attraction.copyrightDivCd,
            thumbnailUrl = attraction.thumbnailUrl,
            mapLevel = attraction.mapLevel,
            zipcode = attraction.zipcode,
            sourceCreatedAt = attraction.sourceCreatedAt,
            latitude = attraction.latitude,
            longitude = attraction.longitude,
            imageUrl = attraction.imageUrl,
            tel = attraction.tel,
            overview = attraction.overview,
            sourceModifiedAt = attraction.sourceModifiedAt,
            status = attraction.status,
            createdAt = attraction.createdAt,
        )
    }
}
