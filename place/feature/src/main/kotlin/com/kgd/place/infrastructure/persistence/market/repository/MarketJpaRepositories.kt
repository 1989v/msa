package com.kgd.place.infrastructure.persistence.market.repository

import org.springframework.data.jpa.repository.Modifying
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
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import jakarta.persistence.LockModeType

interface MarketJpaRepository : JpaRepository<MarketJpaEntity, Long> {
    fun findByAttractionContentId(attractionContentId: String): MarketJpaEntity?
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select m from MarketJpaEntity m where m.id = :id")
    fun lockById(@Param("id") id: Long): MarketJpaEntity?
    fun findByNameContainingIgnoreCase(name: String, pageable: Pageable): Page<MarketJpaEntity>
}
interface MarketZoneJpaRepository : JpaRepository<MarketZoneJpaEntity, Long> {
    fun findAllByMarketIdOrderBySortOrderAscIdAsc(marketId: Long): List<MarketZoneJpaEntity>
    fun findByMarketIdAndSourceAndSourceKey(marketId: Long, source: MarketZoneSource, sourceKey: String): MarketZoneJpaEntity?
}
interface MarketStoreJpaRepository : JpaRepository<MarketStoreJpaEntity, Long> {
    fun findByMarketIdAndSanggaKey(marketId: Long, sanggaKey: String): MarketStoreJpaEntity?
    fun findAllByMarketId(marketId: Long): List<MarketStoreJpaEntity>
    fun findAllByMarketIdAndSourceAndNameAndJibunAddress(
        marketId: Long, source: MarketStoreSource, name: String, jibunAddress: String,
    ): List<MarketStoreJpaEntity>
    fun findByMarketIdAndSourceAndSourceKey(marketId: Long, source: MarketStoreSource, sourceKey: String): MarketStoreJpaEntity?
    @Modifying
    @Query("update MarketStoreJpaEntity s set s.pairedStoreId = null where s.marketId = :marketId and s.pairedStoreId is not null")
    fun clearPairs(@Param("marketId") marketId: Long): Int
    @Modifying
    @Query("update MarketStoreJpaEntity s set s.pairedStoreId = :partnerId where s.id = :storeId")
    fun pair(@Param("storeId") storeId: Long, @Param("partnerId") partnerId: Long): Int
}
interface MarketStoreOverrideJpaRepository : JpaRepository<MarketStoreOverrideJpaEntity, Long> {
    fun findAllByStoreIdIn(storeIds: List<Long>): List<MarketStoreOverrideJpaEntity>
    fun findByStoreIdAndField(storeId: Long, field: MarketStoreField): MarketStoreOverrideJpaEntity?
}
interface MarketChangeLogJpaRepository : JpaRepository<MarketChangeLogJpaEntity, Long> {
    fun findAllByMarketId(marketId: Long, pageable: Pageable): Page<MarketChangeLogJpaEntity>
}
interface MarketStewardJpaRepository : JpaRepository<MarketStewardJpaEntity, Long> {
    @Query("select s.marketId from MarketStewardJpaEntity s where s.id = :id")
    fun marketIdById(@Param("id") id: Long): Long?
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from MarketStewardJpaEntity s where s.id = :id")
    fun lockById(@Param("id") id: Long): MarketStewardJpaEntity?
    fun findAllByStatus(status: com.kgd.place.domain.market.model.MarketStewardStatus, pageable: Pageable): Page<MarketStewardJpaEntity>
    fun findByMarketIdAndMemberId(marketId: Long, memberId: Long): MarketStewardJpaEntity?
}
