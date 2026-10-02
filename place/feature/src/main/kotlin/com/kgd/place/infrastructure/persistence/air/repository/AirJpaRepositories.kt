package com.kgd.place.infrastructure.persistence.air.repository

import com.kgd.place.infrastructure.persistence.air.entity.AirMeasurementJpaEntity
import com.kgd.place.infrastructure.persistence.air.entity.AirStationJpaEntity
import com.kgd.place.infrastructure.persistence.air.entity.AirStationSigunguId
import com.kgd.place.infrastructure.persistence.air.entity.AirStationSigunguJpaEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.LocalDateTime

/*
 * 쓰기는 키 upsert 다 — `saveAll` 은 행마다 SELECT 를 먼저 보낸다.
 * 측정은 「측정 시각이 같거나 새로울 때만」 덮는다: 늦게 도착한 옛 회차(재실행)가 새 측정을 덮지 않게.
 * 이번 회차에 측정이 없는 측정소(dataTime 없음)는 저장된 측정을 지우지 않는다 — 화면은 3시간이 지나면 알아서 숨긴다.
 * MySQL 은 ON DUPLICATE KEY UPDATE 의 대입을 왼쪽부터 적용하므로 측정 시각 컬럼을 맨 뒤에 바꾼다.
 */

interface AirStationJpaRepository : JpaRepository<AirStationJpaEntity, String> {

    @Modifying
    @Query(
        value = """
            INSERT INTO air_station (station_name, latitude, longitude, item_raw, synced_at)
            VALUES (:name, :latitude, :longitude, :itemRaw, :syncedAt)
            ON DUPLICATE KEY UPDATE
                latitude = VALUES(latitude), longitude = VALUES(longitude), item_raw = VALUES(item_raw), synced_at = VALUES(synced_at)
        """,
        nativeQuery = true,
    )
    fun upsert(
        @Param("name") name: String,
        @Param("latitude") latitude: Double,
        @Param("longitude") longitude: Double,
        @Param("itemRaw") itemRaw: String,
        @Param("syncedAt") syncedAt: LocalDateTime,
    ): Int
}

interface AirMeasurementJpaRepository : JpaRepository<AirMeasurementJpaEntity, String> {

    @Modifying
    @Query(
        value = """
            INSERT INTO air_measurement (station_name, sido_name, data_time, item_raw, fetched_at)
            VALUES (:name, :sidoName, :dataTime, :itemRaw, :fetchedAt)
            ON DUPLICATE KEY UPDATE
                sido_name = IF(data_time IS NULL OR VALUES(data_time) >= data_time, VALUES(sido_name), sido_name),
                item_raw = IF(data_time IS NULL OR VALUES(data_time) >= data_time, VALUES(item_raw), item_raw),
                fetched_at = IF(data_time IS NULL OR VALUES(data_time) >= data_time, VALUES(fetched_at), fetched_at),
                data_time = IF(data_time IS NULL OR VALUES(data_time) >= data_time, VALUES(data_time), data_time)
        """,
        nativeQuery = true,
    )
    fun upsert(
        @Param("name") name: String,
        @Param("sidoName") sidoName: String,
        @Param("dataTime") dataTime: LocalDateTime?,
        @Param("itemRaw") itemRaw: String,
        @Param("fetchedAt") fetchedAt: LocalDateTime,
    ): Int
}

/** 시군구 단위 교체 — 지우고 넣는다. 같은 트랜잭션에서 같은 (시군구, 측정소) 를 다시 넣어도 키에 걸리지 않는다. */
interface AirStationSigunguJpaRepository : JpaRepository<AirStationSigunguJpaEntity, AirStationSigunguId> {

    @Modifying
    @Query(value = "DELETE FROM air_station_sigungu WHERE sigungu_code IN (:codes)", nativeQuery = true)
    fun deleteBySigungu(@Param("codes") codes: Collection<String>): Int

    @Modifying
    @Query(
        value = """
            INSERT INTO air_station_sigungu (sigungu_code, station_name, distance_m, attractions, synced_at)
            VALUES (:code, :name, :distanceM, :attractions, :syncedAt)
        """,
        nativeQuery = true,
    )
    fun insert(
        @Param("code") code: String,
        @Param("name") name: String,
        @Param("distanceM") distanceM: Int?,
        @Param("attractions") attractions: Int,
        @Param("syncedAt") syncedAt: LocalDateTime,
    ): Int

    fun findByIdSigunguCode(sigunguCode: String): List<AirStationSigunguJpaEntity>

    @Query(
        value = "SELECT sigungu_code FROM air_station_sigungu WHERE station_name IN (:names)",
        nativeQuery = true,
    )
    fun findCodesByStations(@Param("names") names: Collection<String>): List<String>
}
