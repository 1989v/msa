package com.kgd.codedictionary.application.display.usecase

import com.kgd.codedictionary.application.display.dto.DisplayOpenSourceDto

/** 메인에 전시할 오픈소스 항목 조회. */
interface GetOpenSourceItemsUseCase {
    fun activeItems(): List<DisplayOpenSourceDto>
}
