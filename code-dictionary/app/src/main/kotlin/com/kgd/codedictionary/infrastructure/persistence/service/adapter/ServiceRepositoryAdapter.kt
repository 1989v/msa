package com.kgd.codedictionary.infrastructure.persistence.service.adapter

import com.kgd.codedictionary.application.service.port.ServiceRepositoryPort
import com.kgd.codedictionary.domain.service.model.Service
import com.kgd.codedictionary.infrastructure.persistence.service.repository.ServiceJpaRepository
import org.springframework.stereotype.Component

@Component
class ServiceRepositoryAdapter(
    private val jpaRepository: ServiceJpaRepository
) : ServiceRepositoryPort {

    override fun findAllOrdered(includePrivate: Boolean): List<Service> {
        val entities = if (includePrivate) {
            jpaRepository.findAllByOrderByDisplayOrderAsc()
        } else {
            jpaRepository.findAllByIsPrivateFalseOrderByDisplayOrderAsc()
        }
        return entities.map { it.toDomain() }
    }
}
