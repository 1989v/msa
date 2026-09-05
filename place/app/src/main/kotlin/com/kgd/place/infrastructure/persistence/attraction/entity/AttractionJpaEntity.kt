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

    // title 에서 파생 (AttractionTitle) — 저장 때마다 도메인이 다시 계산해 온다.
    // 원천(title)은 덮지 않고 파생 컬럼을 따로 두는 규칙 (data-sources.md §0 ②).
    @Column(name = "title_display", nullable = false, length = 300)
    val titleDisplay: String,

    @Column(name = "title_local", length = 300)
    val titleLocal: String? = null,

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

    /** detailIntro2 응답 원문. 안을 질의하지 않으므로 문자열로 둔다 (ranking payload 와 같은 방식). */
    @Column(name = "intro_raw", columnDefinition = "json")
    val introRaw: String? = null,

    @Column(name = "use_time", columnDefinition = "TEXT")
    val useTime: String? = null,

    @Column(name = "rest_date", columnDefinition = "TEXT")
    val restDate: String? = null,

    @Column(name = "use_fee", columnDefinition = "TEXT")
    val useFee: String? = null,

    @Column(name = "parking", columnDefinition = "TEXT")
    val parking: String? = null,

    @Column(name = "parking_fee", columnDefinition = "TEXT")
    val parkingFee: String? = null,

    @Column(name = "info_center", length = 255)
    val infoCenter: String? = null,

    @Column(name = "intro_synced_at")
    val introSyncedAt: java.time.LocalDateTime? = null,


    // Places Text Search 로 채우는 보강 필드 — id 외에는 저장하지 않는다 (data-sources.md §7)
    @Column(name = "google_place_id", length = 128)
    val googlePlaceId: String? = null,

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
        introRaw = introRaw,
        useTime = useTime,
        restDate = restDate,
        useFee = useFee,
        parking = parking,
        parkingFee = parkingFee,
        infoCenter = infoCenter,
        introSyncedAt = introSyncedAt,
        googlePlaceId = googlePlaceId,
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
            titleDisplay = attraction.titleDisplay,
            titleLocal = attraction.titleLocal,
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
            introRaw = attraction.introRaw,
            useTime = attraction.useTime,
            restDate = attraction.restDate,
            useFee = attraction.useFee,
            parking = attraction.parking,
            parkingFee = attraction.parkingFee,
            infoCenter = attraction.infoCenter,
            introSyncedAt = attraction.introSyncedAt,
            googlePlaceId = attraction.googlePlaceId,
            sourceModifiedAt = attraction.sourceModifiedAt,
            status = attraction.status,
            createdAt = attraction.createdAt,
        )
    }
}
