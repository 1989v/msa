package com.kgd.place.infrastructure.persistence.weather.entity

import jakarta.persistence.Column
import jakarta.persistence.Embeddable
import jakarta.persistence.EmbeddedId
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.io.Serializable
import java.time.LocalDateTime

/*
 * 날씨 표 넷. 컬럼 정의는 `V27__create_weather.sql` 이 SSOT 다.
 * 쓰기는 저장소의 upsert 쿼리가 한다 — 이 엔티티들은 스키마 검증과 PK 읽기용이다.
 * 원문 JSON 은 안을 질의하지 않으므로 문자열로 둔다(attractions.intro_raw 와 같은 방식).
 */

@Entity
@Table(name = "weather_sigungu_grid")
class WeatherSigunguGridJpaEntity(
    @Id
    @Column(name = "sigungu_code", length = 5)
    val sigunguCode: String,

    @Column(nullable = false)
    val nx: Short,

    @Column(nullable = false)
    val ny: Short,

    @Column(name = "land_reg_id", length = 8)
    val landRegId: String?,

    @Column(name = "ta_reg_id", length = 8)
    val taRegId: String?,

    @Column(name = "ta_match", length = 16)
    val taMatch: String?,

    @Column(name = "synced_at", nullable = false)
    val syncedAt: LocalDateTime,
)

@Entity
@Table(name = "weather_short_forecast")
class WeatherShortForecastJpaEntity(
    @EmbeddedId
    val id: WeatherGridId,

    @Column(name = "base_at", nullable = false)
    val baseAt: LocalDateTime,

    @Column(name = "items_raw", nullable = false, columnDefinition = "json")
    val itemsRaw: String,

    @Column(name = "fetched_at", nullable = false)
    val fetchedAt: LocalDateTime,
)

@Embeddable
data class WeatherGridId(
    @Column(nullable = false)
    val nx: Short,

    @Column(nullable = false)
    val ny: Short,
) : Serializable

@Entity
@Table(name = "weather_mid_region")
class WeatherMidRegionJpaEntity(
    @Id
    @Column(name = "reg_id", length = 8)
    val regId: String,

    @Column(nullable = false, length = 8)
    val kind: String,

    @Column(nullable = false, length = 40)
    val name: String,
)

@Entity
@Table(name = "weather_mid_forecast")
class WeatherMidForecastJpaEntity(
    @EmbeddedId
    val id: WeatherMidForecastId,

    @Column(name = "tm_fc", nullable = false)
    val tmFc: LocalDateTime,

    @Column(name = "item_raw", nullable = false, columnDefinition = "json")
    val itemRaw: String,

    @Column(name = "fetched_at", nullable = false)
    val fetchedAt: LocalDateTime,
)

@Embeddable
data class WeatherMidForecastId(
    @Column(name = "reg_id", nullable = false, length = 8)
    val regId: String,

    @Column(nullable = false, length = 8)
    val kind: String,
) : Serializable
