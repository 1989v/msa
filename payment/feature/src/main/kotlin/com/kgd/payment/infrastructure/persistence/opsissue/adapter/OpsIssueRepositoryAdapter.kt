package com.kgd.payment.infrastructure.persistence.opsissue.adapter

import com.kgd.common.exception.NotFoundException
import com.kgd.payment.application.opsissue.port.OpsIssuePage
import com.kgd.payment.application.opsissue.port.OpsIssueRepositoryPort
import com.kgd.payment.domain.opsissue.model.OpsIssue
import com.kgd.payment.domain.opsissue.model.OpsIssueStatus
import com.kgd.payment.infrastructure.persistence.opsissue.entity.OpsIssueJpaEntity
import com.kgd.payment.infrastructure.persistence.opsissue.repository.OpsIssueJpaRepository
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.stereotype.Component

@Component
class OpsIssueRepositoryAdapter(
    private val jpaRepository: OpsIssueJpaRepository,
) : OpsIssueRepositoryPort {

    override fun save(issue: OpsIssue): OpsIssue {
        val id = issue.id ?: return jpaRepository.save(OpsIssueJpaEntity.newFrom(issue)).toDomain()
        val entity = jpaRepository.findById(id).orElseThrow { NotFoundException("OpsIssue", id) }
        entity.syncFrom(issue)
        return jpaRepository.save(entity).toDomain()
    }

    override fun findById(id: Long): OpsIssue? = jpaRepository.findById(id).orElse(null)?.toDomain()

    override fun findPage(status: OpsIssueStatus?, page: Int, size: Int): OpsIssuePage {
        val pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "id"))
        val result = if (status == null) jpaRepository.findAll(pageable) else jpaRepository.findAllByStatus(status, pageable)
        return OpsIssuePage(result.content.map { it.toDomain() }, result.totalElements)
    }
}
