package com.kgd.place.infrastructure.persistence.transit.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDate
import java.time.LocalDateTime

/** 전국 버스정류장 위치정보 원천 한 행(회차). 컬럼 정의는 `V35__transit_stops_and_attraction_access.sql` 이 SSOT. */
@Entity
@Table(name = "transit_bus_stop")
class TransitBusStopJpaEntity(
    @Column(name = "load_run_id", nullable = false, length = 32) val loadRunId: String,
    @Column(name = "source_key", nullable = false, length = 80) val sourceKey: String,
    @Column(name = "stop_no", nullable = false, length = 40) val stopNo: String,
    @Column(name = "stop_name", nullable = false, length = 100) val stopName: String,
    @Column(name = "lat_raw", nullable = false, length = 40) val latRaw: String,
    @Column(name = "lng_raw", nullable = false, length = 40) val lngRaw: String,
    @Column(name = "collected_date_raw", nullable = false, length = 40) val collectedDateRaw: String,
    @Column(name = "mobile_short_no", nullable = false, length = 40) val mobileShortNo: String,
    @Column(name = "city_code", nullable = false, length = 20) val cityCode: String,
    @Column(name = "city_name", nullable = false, length = 60) val cityName: String,
    @Column(name = "manage_city_name", nullable = false, length = 40) val manageCityName: String,
    @Column(name = "lat_value") val latValue: Double?,
    @Column(name = "lng_value") val lngValue: Double?,
    @Column(name = "valid_coord", nullable = false) val validCoord: Boolean,
    @Column(name = "collected_date") val collectedDate: LocalDate?,
    @Column(name = "loaded_at", nullable = false) val loadedAt: LocalDateTime,
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null
}
