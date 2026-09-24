package com.kgd.promotion.infrastructure.persistence.point.repository

import com.kgd.promotion.infrastructure.persistence.point.entity.PointBalanceJpaEntity
import com.kgd.promotion.infrastructure.persistence.point.entity.PointLedgerJpaEntity
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository

interface PointBalanceJpaRepository : JpaRepository<PointBalanceJpaEntity, Long> {
    fun findByMemberId(memberId: String): PointBalanceJpaEntity?
}

interface PointLedgerJpaRepository : JpaRepository<PointLedgerJpaEntity, Long> {
    fun findAllByMemberIdOrderByIdDesc(memberId: String, pageable: Pageable): List<PointLedgerJpaEntity>
}
