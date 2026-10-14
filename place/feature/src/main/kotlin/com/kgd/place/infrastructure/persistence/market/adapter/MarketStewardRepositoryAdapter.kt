package com.kgd.place.infrastructure.persistence.market.adapter

import com.kgd.place.application.market.port.MarketStewardPort
import com.kgd.place.domain.market.model.MarketSteward
import com.kgd.place.domain.market.model.MarketStewardStatus
import com.kgd.place.infrastructure.persistence.market.entity.MarketStewardJpaEntity
import com.kgd.place.infrastructure.persistence.market.repository.MarketStewardJpaRepository
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.stereotype.Repository

@Repository
class MarketStewardRepositoryAdapter(private val repository: MarketStewardJpaRepository) : MarketStewardPort {
    private val log = KotlinLogging.logger {}
    override fun find(marketId: Long, memberId: Long) = repository.findByMarketIdAndMemberId(marketId, memberId)?.toDomain()
    override fun marketIdById(id: Long) = repository.marketIdById(id)
    override fun lockById(id: Long) = repository.lockById(id)?.toDomain()
    override fun list(status: MarketStewardStatus?, page: Int, size: Int): Pair<List<MarketSteward>, Long> {
        val pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "id"))
        val rows = if (status == null) repository.findAll(pageable) else repository.findAllByStatus(status, pageable)
        return rows.content.map { it.toDomain() } to rows.totalElements
    }
    override fun save(row: MarketSteward) = repository.saveAndFlush(MarketStewardJpaEntity.fromDomain(row)).toDomain()
}
