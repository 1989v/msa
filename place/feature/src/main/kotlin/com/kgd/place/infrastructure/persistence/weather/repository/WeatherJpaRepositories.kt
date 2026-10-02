package com.kgd.place.infrastructure.persistence.weather.repository

import com.kgd.place.infrastructure.persistence.weather.entity.WeatherGridId
import com.kgd.place.infrastructure.persistence.weather.entity.WeatherMidForecastId
import com.kgd.place.infrastructure.persistence.weather.entity.WeatherMidForecastJpaEntity
import com.kgd.place.infrastructure.persistence.weather.entity.WeatherMidRegionJpaEntity
import com.kgd.place.infrastructure.persistence.weather.entity.WeatherShortForecastJpaEntity
import com.kgd.place.infrastructure.persistence.weather.entity.WeatherSigunguGridJpaEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.LocalDateTime

/*
 * 쓰기는 키 upsert 다 — `saveAll` 은 행마다 SELECT 를 먼저 보낸다.
 * 예보 둘은 「발표 시각이 같거나 새로울 때만」 덮는다: 늦게 도착한 옛 발표본(재실행·백필)이 새 발표본을 덮지 않게.
 * MySQL 은 ON DUPLICATE KEY UPDATE 의 대입을 왼쪽부터 적용하므로 발표 시각 컬럼을 맨 뒤에 바꾼다.
 */

interface WeatherSigunguGridJpaRepository : JpaRepository<WeatherSigunguGridJpaEntity, String> {

    @Modifying
    @Query(
        value = """
            INSERT INTO weather_sigungu_grid (sigungu_code, nx, ny, land_reg_id, ta_reg_id, ta_match, synced_at)
            VALUES (:code, :nx, :ny, :landRegId, :taRegId, :taMatch, :syncedAt)
            ON DUPLICATE KEY UPDATE
                nx = VALUES(nx), ny = VALUES(ny), land_reg_id = VALUES(land_reg_id), ta_reg_id = VALUES(ta_reg_id),
                ta_match = VALUES(ta_match), synced_at = VALUES(synced_at)
        """,
        nativeQuery = true,
    )
    fun upsert(
        @Param("code") code: String,
        @Param("nx") nx: Int,
        @Param("ny") ny: Int,
        @Param("landRegId") landRegId: String?,
        @Param("taRegId") taRegId: String?,
        @Param("taMatch") taMatch: String?,
        @Param("syncedAt") syncedAt: LocalDateTime,
    ): Int

    @Query(
        value = "SELECT sigungu_code FROM weather_sigungu_grid WHERE nx = :nx AND ny = :ny",
        nativeQuery = true,
    )
    fun findCodesByGrid(@Param("nx") nx: Int, @Param("ny") ny: Int): List<String>

    @Query(
        value = """
            SELECT sigungu_code FROM weather_sigungu_grid
            WHERE land_reg_id IN (:regIds) OR ta_reg_id IN (:regIds)
        """,
        nativeQuery = true,
    )
    fun findCodesByMidRegions(@Param("regIds") regIds: Collection<String>): List<String>
}

interface WeatherShortForecastJpaRepository : JpaRepository<WeatherShortForecastJpaEntity, WeatherGridId> {

    @Modifying
    @Query(
        value = """
            INSERT INTO weather_short_forecast (nx, ny, base_at, items_raw, fetched_at)
            VALUES (:nx, :ny, :baseAt, :itemsRaw, :fetchedAt)
            ON DUPLICATE KEY UPDATE
                items_raw = IF(VALUES(base_at) >= base_at, VALUES(items_raw), items_raw),
                fetched_at = IF(VALUES(base_at) >= base_at, VALUES(fetched_at), fetched_at),
                base_at = GREATEST(base_at, VALUES(base_at))
        """,
        nativeQuery = true,
    )
    fun upsert(
        @Param("nx") nx: Int,
        @Param("ny") ny: Int,
        @Param("baseAt") baseAt: LocalDateTime,
        @Param("itemsRaw") itemsRaw: String,
        @Param("fetchedAt") fetchedAt: LocalDateTime,
    ): Int
}

interface WeatherMidRegionJpaRepository : JpaRepository<WeatherMidRegionJpaEntity, String> {

    @Modifying
    @Query(
        value = """
            INSERT INTO weather_mid_region (reg_id, kind, name) VALUES (:regId, :kind, :name)
            ON DUPLICATE KEY UPDATE kind = VALUES(kind), name = VALUES(name)
        """,
        nativeQuery = true,
    )
    fun upsert(@Param("regId") regId: String, @Param("kind") kind: String, @Param("name") name: String): Int
}

interface WeatherMidForecastJpaRepository : JpaRepository<WeatherMidForecastJpaEntity, WeatherMidForecastId> {

    @Modifying
    @Query(
        value = """
            INSERT INTO weather_mid_forecast (reg_id, kind, tm_fc, item_raw, fetched_at)
            VALUES (:regId, :kind, :tmFc, :itemRaw, :fetchedAt)
            ON DUPLICATE KEY UPDATE
                item_raw = IF(VALUES(tm_fc) >= tm_fc, VALUES(item_raw), item_raw),
                fetched_at = IF(VALUES(tm_fc) >= tm_fc, VALUES(fetched_at), fetched_at),
                tm_fc = GREATEST(tm_fc, VALUES(tm_fc))
        """,
        nativeQuery = true,
    )
    fun upsert(
        @Param("regId") regId: String,
        @Param("kind") kind: String,
        @Param("tmFc") tmFc: LocalDateTime,
        @Param("itemRaw") itemRaw: String,
        @Param("fetchedAt") fetchedAt: LocalDateTime,
    ): Int
}
