package com.kgd.place.infrastructure.persistence.market.repository

import com.kgd.place.domain.market.model.MarketStoreField
import com.kgd.place.domain.market.model.MarketStoreSource
import com.kgd.place.domain.market.model.MarketZoneSource
import com.kgd.place.infrastructure.persistence.market.entity.MarketChangeLogJpaEntity
import com.kgd.place.infrastructure.persistence.market.entity.MarketJpaEntity
import com.kgd.place.infrastructure.persistence.market.entity.MarketStewardJpaEntity
import com.kgd.place.infrastructure.persistence.market.entity.MarketStoreJpaEntity
import com.kgd.place.infrastructure.persistence.market.entity.MarketStoreOverrideJpaEntity
import com.kgd.place.infrastructure.persistence.market.entity.MarketZoneJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface MarketJpaRepository : JpaRepository<MarketJpaEntity, Long> {
    fun findByAttractionContentId(attractionContentId: String): MarketJpaEntity?
}
interface MarketZoneJpaRepository : JpaRepository<MarketZoneJpaEntity, Long> {
    fun findAllByMarketIdOrderBySortOrderAscIdAsc(marketId: Long): List<MarketZoneJpaEntity>
    fun findByMarketIdAndSourceAndSourceKey(marketId: Long, source: MarketZoneSource, sourceKey: String): MarketZoneJpaEntity?
}
interface MarketStoreJpaRepository : JpaRepository<MarketStoreJpaEntity, Long> {
    fun findByMarketIdAndSanggaKey(marketId: Long, sanggaKey: String): MarketStoreJpaEntity?
    fun findAllByMarketIdOrderByIdAsc(marketId: Long): List<MarketStoreJpaEntity>
    fun findByMarketIdAndSourceAndSourceKey(marketId: Long, source: MarketStoreSource, sourceKey: String): MarketStoreJpaEntity?
}
interface MarketStoreOverrideJpaRepository : JpaRepository<MarketStoreOverrideJpaEntity, Long> {
    fun findAllByStoreIdIn(storeIds: List<Long>): List<MarketStoreOverrideJpaEntity>
    fun findByStoreIdAndField(storeId: Long, field: MarketStoreField): MarketStoreOverrideJpaEntity?
}
interface MarketChangeLogJpaRepository : JpaRepository<MarketChangeLogJpaEntity, Long>
interface MarketStewardJpaRepository : JpaRepository<MarketStewardJpaEntity, Long> {
    fun findByMarketIdAndMemberId(marketId: Long, memberId: Long): MarketStewardJpaEntity?
}
