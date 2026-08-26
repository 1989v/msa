package com.kgd.codedictionary.application.display.service

import com.kgd.codedictionary.application.display.dto.DisplayServiceDto
import com.kgd.codedictionary.application.display.dto.DisplayServiceUpsertRequest
import com.kgd.codedictionary.application.display.port.DisplayServiceRepositoryPort
import com.kgd.codedictionary.application.display.usecase.ManageDisplayServicesUseCase
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/** 메인 전시 관리 (ADR-0066). 어드민은 HOLD 까지 본다. */
@Service
@Transactional(readOnly = true)
class DisplayAdminService(
    private val repository: DisplayServiceRepositoryPort,
) : ManageDisplayServicesUseCase {
    override fun allServices(): List<DisplayServiceDto> =
        repository.findAll().map(DisplayServiceDto::from)

    @Transactional
    override fun upsert(request: DisplayServiceUpsertRequest): DisplayServiceDto =
        DisplayServiceDto.from(repository.save(request.toDomain()))

    @Transactional
    override fun delete(id: Long) = repository.delete(id)
}
