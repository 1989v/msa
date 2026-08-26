package com.kgd.ranking.infrastructure.persistence.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import com.kgd.ranking.domain.model.GasPrice
import com.kgd.ranking.domain.model.GasStation
import java.math.BigDecimal
import java.time.Instant
import java.time.LocalDate

/**
 * 주유소 — 오피넷 수집분 (ADR-0081).
 *
 * **좌표가 두 벌인 것이 이 엔티티의 핵심이다.** 원천은 KATEC(TM128) 로 주는데 값이 십만 단위라
 * 위경도로 착각해도 그럴듯해 보인다. 수집기가 WGS84 로 변환한 값을 [latitude]/[longitude] 에
 * 넣고, 원천 좌표는 [katecX]/[katecY] 에 그대로 남긴다 — 변환 규칙이 틀렸을 때 되돌릴 근거가
 * DB 안에 있어야 한다 (data-sources.md §0 ①②).
 *
 * [syncFrom] 은 **전체 동기화**다 — 넘어오지 않은 값은 null 이 된다. 필드를 추가하면
 * 수집기의 `UPSERT_FIELDS` 와 조회 응답 DTO **양쪽**을 함께 고쳐야 하고,
 * `GasStationDtoRoundTripTest` 가 그 왕복을 강제한다.
 */
@Entity
@Table(name = "gas_station")
class GasStationJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "opinet_id", nullable = false, length = 30, unique = true)
    val opinetId: String = "",

    name: String = "",
    brandCode: String? = null,
    brandName: String? = null,
    isSelf: Boolean = false,
    katecX: BigDecimal? = null,
    katecY: BigDecimal? = null,
    latitude: BigDecimal? = null,
    longitude: BigDecimal? = null,
    areaCode: String? = null,
    areaName: String? = null,
    roadAddress: String? = null,
    jibunAddress: String? = null,
    tel: String? = null,
    hasCarWash: Boolean? = null,
    hasMaintenance: Boolean? = null,
    hasCvs: Boolean? = null,
    is24h: Boolean? = null,
    syncedAt: Instant = Instant.EPOCH,
) {
    @Column(nullable = false, length = 200)
    var name: String = name
        private set

    @Column(name = "brand_code", length = 10)
    var brandCode: String? = brandCode
        private set

    @Column(name = "brand_name", length = 50)
    var brandName: String? = brandName
        private set

    @Column(name = "is_self", nullable = false)
    var isSelf: Boolean = isSelf
        private set

    @Column(name = "katec_x", precision = 14, scale = 4)
    var katecX: BigDecimal? = katecX
        private set

    @Column(name = "katec_y", precision = 14, scale = 4)
    var katecY: BigDecimal? = katecY
        private set

    @Column(precision = 10, scale = 7)
    var latitude: BigDecimal? = latitude
        private set

    @Column(precision = 10, scale = 7)
    var longitude: BigDecimal? = longitude
        private set

    @Column(name = "area_code", length = 10)
    var areaCode: String? = areaCode
        private set

    @Column(name = "area_name", length = 60)
    var areaName: String? = areaName
        private set

    @Column(name = "road_address", length = 300)
    var roadAddress: String? = roadAddress
        private set

    @Column(name = "jibun_address", length = 300)
    var jibunAddress: String? = jibunAddress
        private set

    @Column(length = 30)
    var tel: String? = tel
        private set

    @Column(name = "has_car_wash")
    var hasCarWash: Boolean? = hasCarWash
        private set

    @Column(name = "has_maintenance")
    var hasMaintenance: Boolean? = hasMaintenance
        private set

    @Column(name = "has_cvs")
    var hasCvs: Boolean? = hasCvs
        private set

    @Column(name = "is_24h")
    var is24h: Boolean? = is24h
        private set

    @Column(name = "synced_at", nullable = false)
    var syncedAt: Instant = syncedAt
        private set

    /** 전체 동기화 — 넘어오지 않은 값은 지워진다. 부분 수정에 쓰지 말 것. */
    fun syncFrom(other: GasStationJpaEntity) {
        name = other.name
        brandCode = other.brandCode
        brandName = other.brandName
        isSelf = other.isSelf
        katecX = other.katecX
        katecY = other.katecY
        latitude = other.latitude
        longitude = other.longitude
        areaCode = other.areaCode
        areaName = other.areaName
        roadAddress = other.roadAddress
        jibunAddress = other.jibunAddress
        tel = other.tel
        hasCarWash = other.hasCarWash
        hasMaintenance = other.hasMaintenance
        hasCvs = other.hasCvs
        is24h = other.is24h
        syncedAt = other.syncedAt
    }

    fun toDomain(prices: List<GasStationPriceJpaEntity>) = GasStation(
        id = id,
        opinetId = opinetId,
        name = name,
        brandCode = brandCode,
        brandName = brandName,
        isSelf = isSelf,
        katecX = katecX,
        katecY = katecY,
        latitude = latitude,
        longitude = longitude,
        areaCode = areaCode,
        areaName = areaName,
        roadAddress = roadAddress,
        jibunAddress = jibunAddress,
        tel = tel,
        hasCarWash = hasCarWash,
        hasMaintenance = hasMaintenance,
        hasCvs = hasCvs,
        is24h = is24h,
        syncedAt = syncedAt,
        prices = prices.map { GasPrice(it.productCode, it.price, it.tradedAt) },
    )

    companion object {
        /** 가격은 별도 테이블이라 여기 담지 않는다 — 어댑터가 [GasStationPriceJpaEntity] 로 동기화한다 */
        fun fromDomain(station: GasStation) = GasStationJpaEntity(
            id = station.id,
            opinetId = station.opinetId,
            name = station.name,
            brandCode = station.brandCode,
            brandName = station.brandName,
            isSelf = station.isSelf,
            katecX = station.katecX,
            katecY = station.katecY,
            latitude = station.latitude,
            longitude = station.longitude,
            areaCode = station.areaCode,
            areaName = station.areaName,
            roadAddress = station.roadAddress,
            jibunAddress = station.jibunAddress,
            tel = station.tel,
            hasCarWash = station.hasCarWash,
            hasMaintenance = station.hasMaintenance,
            hasCvs = station.hasCvs,
            is24h = station.is24h,
            syncedAt = station.syncedAt,
        )
    }
}

/**
 * 유종별 판매가.
 *
 * 한 주유소가 여러 유종을 팔고 원천도 유종별 배열로 준다. 가격을 [GasStationJpaEntity] 의
 * 컬럼으로 펴면 유종이 늘 때마다 마이그레이션이 붙는다.
 */
@Entity
@Table(name = "gas_station_price")
class GasStationPriceJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "station_id", nullable = false)
    val stationId: Long = 0,

    @Column(name = "product_code", nullable = false, length = 10)
    val productCode: String = "",

    price: Int = 0,
    tradedAt: LocalDate? = null,
    updatedAt: Instant = Instant.EPOCH,
) {
    @Column(nullable = false)
    var price: Int = price
        private set

    @Column(name = "traded_at")
    var tradedAt: LocalDate? = tradedAt
        private set

    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = updatedAt
        private set

    fun update(price: Int, tradedAt: LocalDate?, updatedAt: Instant) {
        this.price = price
        this.tradedAt = tradedAt
        this.updatedAt = updatedAt
    }
}
