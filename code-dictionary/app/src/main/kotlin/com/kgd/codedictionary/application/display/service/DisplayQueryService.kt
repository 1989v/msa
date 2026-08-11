package com.kgd.codedictionary.application.display.service

import com.kgd.codedictionary.application.display.dto.DisplayServiceDto
import com.kgd.codedictionary.application.display.port.DisplayServiceRepositoryPort
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/** 메인 전시 서비스 공개 조회 (ADR-0066). */
@Service
@Transactional(readOnly = true)
class DisplayQueryService(
    private val repository: DisplayServiceRepositoryPort,
) {
    fun displayedServices(): List<DisplayServiceDto> =
        repository.findAllDisplayed().map(DisplayServiceDto::from)
}
