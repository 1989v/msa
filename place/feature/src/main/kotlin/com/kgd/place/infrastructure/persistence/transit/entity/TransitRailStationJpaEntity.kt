package com.kgd.place.infrastructure.persistence.transit.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDate
import java.time.LocalDateTime

/** 도시철도 역사정보 원천 한 행(회차). 컬럼 정의는 `V35__transit_stops_and_attraction_access.sql` 이 SSOT. */
@Entity
@Table(name = "transit_rail_station")
class TransitRailStationJpaEntity(
    @Column(name = "load_run_id", nullable = false, length = 32) val loadRunId: String,
    @Column(name = "source_key", nullable = false, length = 300) val sourceKey: String,
    @Column(name = "station_no", nullable = false, length = 20) val stationNo: String,
    @Column(name = "station_name", nullable = false, length = 100) val stationName: String,
    @Column(name = "line_no", nullable = false, length = 20) val lineNo: String,
    @Column(name = "line_name", nullable = false, length = 100) val lineName: String,
    @Column(name = "station_name_en", nullable = false, length = 200) val stationNameEn: String,
    @Column(name = "station_name_hanja", nullable = false, length = 100) val stationNameHanja: String,
    @Column(name = "transfer_type", nullable = false, length = 40) val transferType: String,
    @Column(name = "transfer_line_no", nullable = false, length = 200) val transferLineNo: String,
    @Column(name = "transfer_line_name", nullable = false, length = 500) val transferLineName: String,
    @Column(name = "lat_raw", nullable = false, length = 40) val latRaw: String,
    @Column(name = "lng_raw", nullable = false, length = 40) val lngRaw: String,
    @Column(name = "operator_name", nullable = false, length = 100) val operatorName: String,
    @Column(name = "road_address", nullable = false, length = 300) val roadAddress: String,
    @Column(name = "phone", nullable = false, length = 60) val phone: String,
    @Column(name = "base_date_raw", nullable = false, length = 40) val baseDateRaw: String,
    @Column(name = "lat_value") val latValue: Double?,
    @Column(name = "lng_value") val lngValue: Double?,
    @Column(name = "valid_coord", nullable = false) val validCoord: Boolean,
    @Column(name = "base_date") val baseDate: LocalDate?,
    @Column(name = "loaded_at", nullable = false) val loadedAt: LocalDateTime,
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null
}
