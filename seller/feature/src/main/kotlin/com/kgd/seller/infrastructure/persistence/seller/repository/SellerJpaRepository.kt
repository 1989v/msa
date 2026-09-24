package com.kgd.seller.infrastructure.persistence.seller.repository

import com.kgd.seller.domain.seller.model.SellerStatus
import com.kgd.seller.infrastructure.persistence.seller.entity.SellerJpaEntity
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import java.time.Instant

interface SellerJpaRepository : JpaRepository<SellerJpaEntity, Long> {
    fun findAllByMemberIdOrderByIdAsc(memberId: String): List<SellerJpaEntity>
    fun findAllByStatus(status: SellerStatus, pageable: Pageable): Page<SellerJpaEntity>
    fun findAllByStatusAndRejectedAtLessThanEqualAndPiiPurgedAtIsNullOrderByIdAsc(
        status: SellerStatus,
        cutoff: Instant,
        pageable: Pageable,
    ): List<SellerJpaEntity>
}
