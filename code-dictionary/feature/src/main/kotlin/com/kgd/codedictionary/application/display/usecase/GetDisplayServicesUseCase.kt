package com.kgd.codedictionary.application.display.usecase

import com.kgd.codedictionary.application.display.dto.DisplayServiceDto

/** 메인 런처에 전시할 서비스 타일 조회 (ADR-0066). */
interface GetDisplayServicesUseCase {
    fun displayedServices(): List<DisplayServiceDto>
}
