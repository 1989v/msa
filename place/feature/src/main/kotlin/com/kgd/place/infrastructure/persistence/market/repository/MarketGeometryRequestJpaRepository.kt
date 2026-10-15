package com.kgd.place.infrastructure.persistence.market.repository

import com.kgd.place.domain.market.model.GeometryRequestStatus
import com.kgd.place.infrastructure.persistence.market.entity.MarketGeometryRequestJpaEntity
import jakarta.persistence.LockModeType
import jakarta.persistence.QueryHint
import org.springframework.data.jpa.repository.*
import org.springframework.data.repository.query.Param

interface MarketGeometryRequestJpaRepository : JpaRepository<MarketGeometryRequestJpaEntity, Long> {
    fun findAllByMarketIdOrderByIdDesc(marketId: Long): List<MarketGeometryRequestJpaEntity>
    fun findAllByStatusOrderByIdDesc(status: GeometryRequestStatus): List<MarketGeometryRequestJpaEntity>
    fun findAllByOrderByIdDesc(): List<MarketGeometryRequestJpaEntity>
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @QueryHints(QueryHint(name = "jakarta.persistence.cache.storeMode", value = "REFRESH"))
    @Query("select r from MarketGeometryRequestJpaEntity r where r.id = :id")
    fun lockById(@Param("id") id: Long): MarketGeometryRequestJpaEntity?
}
