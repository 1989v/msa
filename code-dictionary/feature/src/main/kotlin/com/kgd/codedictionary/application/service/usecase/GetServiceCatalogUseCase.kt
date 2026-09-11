package com.kgd.codedictionary.application.service.usecase

import com.kgd.codedictionary.application.service.dto.ServiceResultDto

/** 서비스 카탈로그 조회. */
interface GetServiceCatalogUseCase {
    fun findAll(includePrivate: Boolean = false): List<ServiceResultDto>
}
