package com.kgd.codedictionary.application.service.service

import com.kgd.codedictionary.application.service.dto.ServiceResultDto
import com.kgd.codedictionary.application.service.port.ServiceRepositoryPort
import com.kgd.codedictionary.application.service.usecase.GetServiceCatalogUseCase
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
@Transactional(readOnly = true)
class ServiceCatalogService(
    private val serviceRepository: ServiceRepositoryPort
) : GetServiceCatalogUseCase {
    override fun findAll(includePrivate: Boolean): List<ServiceResultDto> =
        serviceRepository.findAllOrdered(includePrivate).map(ServiceResultDto::from)
}
