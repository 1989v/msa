package com.kgd.codedictionary.presentation.service.controller

import com.kgd.codedictionary.application.service.dto.ServiceResultDto
import com.kgd.codedictionary.application.service.usecase.GetServiceCatalogUseCase
import com.kgd.common.response.ApiResponse
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/services")
class ServiceController(
    private val getServiceCatalog: GetServiceCatalogUseCase
) {

    @GetMapping
    fun list(
        @RequestParam(defaultValue = "false") includePrivate: Boolean
    ): ApiResponse<List<ServiceResultDto>> =
        ApiResponse.success(getServiceCatalog.findAll(includePrivate))
}
