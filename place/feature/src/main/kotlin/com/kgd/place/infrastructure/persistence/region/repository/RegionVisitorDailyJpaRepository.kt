package com.kgd.place.infrastructure.persistence.region.repository

import com.kgd.place.domain.region.model.AdministrativeRegionLevel
import com.kgd.place.infrastructure.persistence.region.entity.RegionVisitorDailyId
import com.kgd.place.infrastructure.persistence.region.entity.RegionVisitorDailyJpaEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.math.BigDecimal
import java.time.LocalDate
import java.time.LocalDateTime

interface RegionVisitorDailyJpaRepository : JpaRepository<RegionVisitorDailyJpaEntity, RegionVisitorDailyId> {

    /**
     * 키가 같으면 값을 덮는다 — 같은 날을 다시 받아도 행이 늘지 않는다. `saveAll` 은 행마다 SELECT 를 먼저 보내
     * 백필(달마다 약 2만 5천 행)에서 왕복이 두 배가 된다.
     */
    @Modifying
    @Query(
        value = """
            INSERT INTO region_visitor_daily
                (region_level, region_code, base_ymd, tou_div_cd, tou_num, tou_num_value,
                 region_nm, tou_div_nm, daywk_div_cd, daywk_div_nm, synced_at)
            VALUES (:level, :code, :baseYmd, :touDivCd, :touNum, :touNumValue,
                    :regionNm, :touDivNm, :daywkDivCd, :daywkDivNm, :syncedAt)
            ON DUPLICATE KEY UPDATE
                tou_num = VALUES(tou_num), tou_num_value = VALUES(tou_num_value), region_nm = VALUES(region_nm),
                tou_div_nm = VALUES(tou_div_nm), daywk_div_cd = VALUES(daywk_div_cd),
                daywk_div_nm = VALUES(daywk_div_nm), synced_at = VALUES(synced_at)
        """,
        nativeQuery = true,
    )
    fun upsert(
        @Param("level") level: String,
        @Param("code") code: String,
        @Param("baseYmd") baseYmd: LocalDate,
        @Param("touDivCd") touDivCd: String,
        @Param("touNum") touNum: String,
        @Param("touNumValue") touNumValue: BigDecimal,
        @Param("regionNm") regionNm: String?,
        @Param("touDivNm") touDivNm: String?,
        @Param("daywkDivCd") daywkDivCd: String?,
        @Param("daywkDivNm") daywkDivNm: String?,
        @Param("syncedAt") syncedAt: LocalDateTime,
    ): Int

    @Query("SELECT MAX(v.id.baseYmd) FROM RegionVisitorDailyJpaEntity v WHERE v.id.regionLevel = :level AND v.id.regionCode = :code")
    fun findLatestDate(@Param("level") level: AdministrativeRegionLevel, @Param("code") code: String): LocalDate?

    /** (달, 구분) 합계와 행 수 — PK 앞부분 (수준, 지역, 날짜 ≥ from) 범위 읽기다. */
    @Query(
        value = """
            SELECT DATE_FORMAT(base_ymd, '%Y-%m') AS month, tou_div_cd AS touDivCd,
                   SUM(tou_num_value) AS total, COUNT(*) AS days
            FROM region_visitor_daily
            WHERE region_level = :level AND region_code = :code AND base_ymd >= :from
            GROUP BY month, tou_div_cd
        """,
        nativeQuery = true,
    )
    fun findMonthlyTotals(@Param("level") level: String, @Param("code") code: String, @Param("from") from: LocalDate): List<MonthlyRow>

    interface MonthlyRow {
        fun getMonth(): String
        fun getTouDivCd(): String
        fun getTotal(): BigDecimal
        fun getDays(): Long
    }
}
