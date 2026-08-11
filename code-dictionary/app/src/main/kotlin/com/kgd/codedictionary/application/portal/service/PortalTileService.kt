package com.kgd.codedictionary.application.portal.service

import com.kgd.codedictionary.application.portal.dto.PortalTileDto
import com.kgd.codedictionary.application.portal.port.PortalTileRepositoryPort
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/** 메인 타일 공개 조회 (ADR-0066). */
@Service
@Transactional(readOnly = true)
class PortalTileService(
    private val repository: PortalTileRepositoryPort,
) {
    fun visibleTiles(): List<PortalTileDto> =
        repository.findAllVisible().map(PortalTileDto::from)
}
