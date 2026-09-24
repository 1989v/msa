package com.kgd.promotion.infrastructure.persistence.point.adapter

import com.kgd.common.exception.NotFoundException
import com.kgd.promotion.application.point.port.PointBalanceRepositoryPort
import com.kgd.promotion.application.point.port.PointLedgerRepositoryPort
import com.kgd.promotion.domain.point.model.PointBalance
import com.kgd.promotion.domain.point.model.PointLedgerEntry
import com.kgd.promotion.infrastructure.persistence.point.entity.PointBalanceJpaEntity
import com.kgd.promotion.infrastructure.persistence.point.entity.PointLedgerJpaEntity
import com.kgd.promotion.infrastructure.persistence.point.repository.PointBalanceJpaRepository
import com.kgd.promotion.infrastructure.persistence.point.repository.PointLedgerJpaRepository
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Component

@Component
class PointBalanceRepositoryAdapter(
    private val jpaRepository: PointBalanceJpaRepository,
) : PointBalanceRepositoryPort {

    override fun findByMemberId(memberId: String): PointBalance? = jpaRepository.findByMemberId(memberId)?.toDomain()

    override fun create(balance: PointBalance): PointBalance =
        jpaRepository.saveAndFlush(PointBalanceJpaEntity(memberId = balance.memberId, balance = balance.balance, updatedAt = balance.updatedAt))
            .toDomain()

    override fun save(balance: PointBalance): PointBalance {
        val id = requireNotNull(balance.id) { "새 잔액은 create 로 저장한다" }
        val entity = jpaRepository.findById(id).orElseThrow { NotFoundException("PointBalance", id) }
        entity.syncFrom(balance)
        return jpaRepository.save(entity).toDomain()
    }
}

@Component
class PointLedgerRepositoryAdapter(
    private val jpaRepository: PointLedgerJpaRepository,
) : PointLedgerRepositoryPort {

    override fun append(entry: PointLedgerEntry): PointLedgerEntry = jpaRepository.save(PointLedgerJpaEntity.from(entry)).toDomain()

    override fun findRecentByMemberId(memberId: String, limit: Int): List<PointLedgerEntry> =
        jpaRepository.findAllByMemberIdOrderByIdDesc(memberId, PageRequest.of(0, limit)).map { it.toDomain() }
}
