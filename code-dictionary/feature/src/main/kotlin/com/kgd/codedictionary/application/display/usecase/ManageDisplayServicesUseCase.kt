package com.kgd.codedictionary.application.display.usecase

import com.kgd.codedictionary.application.display.dto.DisplayServiceDto
import com.kgd.codedictionary.application.display.dto.DisplayServiceUpsertRequest

/** 전시 서비스 어드민 CRUD. */
interface ManageDisplayServicesUseCase {
    fun allServices(): List<DisplayServiceDto>
    fun upsert(request: DisplayServiceUpsertRequest): DisplayServiceDto
    fun delete(id: Long)
}
