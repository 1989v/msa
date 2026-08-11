package com.kgd.codedictionary.application.display.service

import com.kgd.codedictionary.application.display.dto.DisplayServiceDto
import com.kgd.codedictionary.application.display.dto.DisplayServiceUpsertRequest
import com.kgd.codedictionary.application.display.port.DisplayServiceRepositoryPort
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/** 메인 전시 관리 (ADR-0066). 어드민은 HOLD 까지 본다. */
@Service
@Transactional(readOnly = true)
class DisplayAdminService(
    private val repository: DisplayServiceRepositoryPort,
) {
    fun allServices(): List<DisplayServiceDto> =
        repository.findAll().map(DisplayServiceDto::from)

    @Transactional
    fun upsert(request: DisplayServiceUpsertRequest): DisplayServiceDto =
        DisplayServiceDto.from(repository.save(request.toDomain()))

    @Transactional
    fun delete(id: Long) = repository.delete(id)
}
