package com.kgd.payment.infrastructure.persistence.opsissue.repository

import com.kgd.payment.domain.opsissue.model.OpsIssueStatus
import com.kgd.payment.infrastructure.persistence.opsissue.entity.OpsIssueJpaEntity
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository

interface OpsIssueJpaRepository : JpaRepository<OpsIssueJpaEntity, Long> {
    fun findAllByStatus(status: OpsIssueStatus, pageable: Pageable): Page<OpsIssueJpaEntity>
}
