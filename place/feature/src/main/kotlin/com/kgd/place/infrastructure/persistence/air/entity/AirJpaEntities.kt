package com.kgd.place.infrastructure.persistence.air.entity

import jakarta.persistence.Column
import jakarta.persistence.Embeddable
import jakarta.persistence.EmbeddedId
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.io.Serializable
import java.time.LocalDateTime

/*
 * 대기 표 셋. 컬럼 정의는 `V30__create_air_quality.sql` 이 SSOT 다.
 * 쓰기는 저장소의 upsert 쿼리가 한다 — 이 엔티티들은 스키마 검증과 PK 읽기용이다.
 * 원문 JSON 은 안을 질의하지 않으므로 문자열로 둔다(weather_short_forecast.items_raw 와 같은 방식).
 */

@Entity
@Table(name = "air_station")
class AirStationJpaEntity(
    @Id
    @Column(name = "station_name", length = 40)
    val stationName: String,

    @Column(nullable = false)
    val latitude: Double,

    @Column(nullable = false)
    val longitude: Double,

    @Column(name = "item_raw", nullable = false, columnDefinition = "json")
    val itemRaw: String,

    @Column(name = "synced_at", nullable = false)
    val syncedAt: LocalDateTime,
)

@Entity
@Table(name = "air_measurement")
class AirMeasurementJpaEntity(
    @Id
    @Column(name = "station_name", length = 40)
    val stationName: String,

    @Column(name = "sido_name", nullable = false, length = 20)
    val sidoName: String,

    @Column(name = "data_time")
    val dataTime: LocalDateTime?,

    @Column(name = "item_raw", nullable = false, columnDefinition = "json")
    val itemRaw: String,

    @Column(name = "fetched_at", nullable = false)
    val fetchedAt: LocalDateTime,
)

@Entity
@Table(name = "air_station_sigungu")
class AirStationSigunguJpaEntity(
    @EmbeddedId
    val id: AirStationSigunguId,

    @Column(name = "distance_m")
    val distanceM: Int?,

    @Column(nullable = false)
    val attractions: Int,

    @Column(name = "synced_at", nullable = false)
    val syncedAt: LocalDateTime,
)

@Embeddable
data class AirStationSigunguId(
    @Column(name = "sigungu_code", nullable = false, length = 5)
    val sigunguCode: String,

    @Column(name = "station_name", nullable = false, length = 40)
    val stationName: String,
) : Serializable
