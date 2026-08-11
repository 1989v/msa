package com.kgd.codedictionary.application.portal.service

import com.kgd.codedictionary.application.portal.dto.PortalTileDto
import com.kgd.codedictionary.application.portal.dto.PortalTileUpsertRequest
import com.kgd.codedictionary.application.portal.port.PortalTileRepositoryPort
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/** 메인 타일 관리 (ADR-0066). 어드민은 HIDDEN 까지 본다. */
@Service
@Transactional(readOnly = true)
class PortalTileAdminService(
    private val repository: PortalTileRepositoryPort,
) {
    fun allTiles(): List<PortalTileDto> =
        repository.findAll().map(PortalTileDto::from)

    @Transactional
    fun upsert(request: PortalTileUpsertRequest): PortalTileDto =
        PortalTileDto.from(repository.save(request.toDomain()))

    @Transactional
    fun delete(id: Long) = repository.delete(id)
}
