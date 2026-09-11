package com.kgd.codedictionary.application.display.service

import com.kgd.codedictionary.application.display.dto.DisplayOpenSourceDto
import com.kgd.codedictionary.application.display.port.DisplayOpenSourceRepositoryPort
import com.kgd.codedictionary.application.display.usecase.GetOpenSourceItemsUseCase
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/** 메인 전시 오픈소스 공개 조회 (ADR-0066 전시 축). */
@Service
@Transactional(readOnly = true)
class DisplayOpenSourceQueryService(
    private val repository: DisplayOpenSourceRepositoryPort,
) : GetOpenSourceItemsUseCase {
    override fun activeItems(): List<DisplayOpenSourceDto> =
        repository.findAllActive().map(DisplayOpenSourceDto::from)
}
