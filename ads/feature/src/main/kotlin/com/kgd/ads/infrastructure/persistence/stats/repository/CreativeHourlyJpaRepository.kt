package com.kgd.ads.infrastructure.persistence.stats.repository

import com.kgd.ads.infrastructure.persistence.stats.entity.CreativeHourlyJpaEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface CreativeHourlyJpaRepository : JpaRepository<CreativeHourlyJpaEntity, CreativeHourlyJpaEntity.Key> {

    /** 소재×지면별 가시 노출·클릭 합 — 예상 클릭률의 입력. */
    @Query(
        "select h.creativeId as creativeId, h.placementKey as placementKey, " +
            "sum(h.impressions) as impressions, sum(h.clicks) as clicks from CreativeHourlyJpaEntity h " +
            "where h.creativeId in :creativeIds group by h.creativeId, h.placementKey",
    )
    fun sumDelivery(@Param("creativeIds") creativeIds: Collection<Long>): List<CreativeDeliverySum>
}

interface CreativeDeliverySum {
    val creativeId: Long
    val placementKey: String
    val impressions: Long
    val clicks: Long
}
