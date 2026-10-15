package com.kgd.place.infrastructure.persistence.market.adapter

import com.kgd.place.application.market.port.MarketGeometryRequestPort
import com.kgd.place.domain.market.model.*
import com.kgd.place.infrastructure.persistence.market.entity.MarketGeometryRequestJpaEntity
import com.kgd.place.infrastructure.persistence.market.repository.MarketGeometryRequestJpaRepository
import org.springframework.stereotype.Repository

@Repository
class MarketGeometryRequestRepositoryAdapter(private val repository: MarketGeometryRequestJpaRepository) : MarketGeometryRequestPort {
    override fun save(request: MarketGeometryRequest) = repository.saveAndFlush(MarketGeometryRequestJpaEntity.fromDomain(request)).toDomain()
    override fun lockById(id: Long) = repository.lockById(id)?.toDomain()
    override fun listForMarket(marketId: Long) = repository.findAllByMarketIdOrderByIdDesc(marketId).map { it.toDomain() }
    override fun list(status: GeometryRequestStatus?) = (if (status == null) repository.findAllByOrderByIdDesc() else repository.findAllByStatusOrderByIdDesc(status)).map { it.toDomain() }
}
