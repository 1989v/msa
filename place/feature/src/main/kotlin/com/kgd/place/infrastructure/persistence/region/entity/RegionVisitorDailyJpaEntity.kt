package com.kgd.place.infrastructure.persistence.region.entity

import com.kgd.place.domain.region.model.AdministrativeRegionLevel
import jakarta.persistence.Column
import jakarta.persistence.Embeddable
import jakarta.persistence.EmbeddedId
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Table
import java.io.Serializable
import java.math.BigDecimal
import java.time.LocalDate
import java.time.LocalDateTime

/**
 * 지역 방문자 하루 한 행. 컬럼 정의는 `V26__create_region_visitor_daily.sql` 이 SSOT.
 * 쓰기는 저장소의 upsert 쿼리가 한다 — 이 엔티티는 스키마 검증과 조회용이다.
 */
@Entity
@Table(name = "region_visitor_daily")
class RegionVisitorDailyJpaEntity(
    @EmbeddedId
    val id: RegionVisitorDailyId,

    @Column(name = "tou_num", nullable = false, length = 32)
    val touNum: String,

    @Column(name = "tou_num_value", nullable = false, precision = 16, scale = 3)
    val touNumValue: BigDecimal,

    @Column(name = "region_nm", length = 40)
    val regionNm: String?,

    @Column(name = "tou_div_nm", length = 20)
    val touDivNm: String?,

    @Column(name = "daywk_div_cd", length = 2)
    val daywkDivCd: String?,

    @Column(name = "daywk_div_nm", length = 10)
    val daywkDivNm: String?,

    @Column(name = "synced_at", nullable = false)
    val syncedAt: LocalDateTime,
)

@Embeddable
data class RegionVisitorDailyId(
    @Enumerated(EnumType.STRING)
    @Column(name = "region_level", nullable = false, length = 8)
    val regionLevel: AdministrativeRegionLevel,

    @Column(name = "region_code", nullable = false, length = 5)
    val regionCode: String,

    @Column(name = "base_ymd", nullable = false)
    val baseYmd: LocalDate,

    @Column(name = "tou_div_cd", nullable = false, length = 2)
    val touDivCd: String,
) : Serializable
