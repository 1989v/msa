package com.kgd.codedictionary.presentation.display.controller

import com.kgd.codedictionary.application.display.dto.DisplayServiceDto
import com.kgd.codedictionary.application.display.usecase.GetDisplayServicesUseCase
import com.kgd.common.response.ApiResponse
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/** 1989v.com 메인에 전시하는 서비스 (ADR-0066). HOLD 는 응답에 포함되지 않는다. */
@RestController
@RequestMapping("/api/v1/display")
class DisplayServiceController(
    private val getDisplayServices: GetDisplayServicesUseCase,
) {

    @GetMapping("/services")
    fun services(): ApiResponse<List<DisplayServiceDto>> =
        ApiResponse.success(getDisplayServices.displayedServices())
}
