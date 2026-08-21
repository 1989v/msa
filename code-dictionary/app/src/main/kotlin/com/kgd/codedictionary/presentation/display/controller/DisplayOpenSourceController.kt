package com.kgd.codedictionary.presentation.display.controller

import com.kgd.codedictionary.application.display.dto.DisplayOpenSourceDto
import com.kgd.codedictionary.application.display.service.DisplayOpenSourceQueryService
import com.kgd.common.response.ApiResponse
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/** 메인에 전시하는 오픈소스 저장소 (ADR-0066 전시 축). active=false 는 응답에 포함되지 않는다. */
@RestController
@RequestMapping("/api/v1/display")
class DisplayOpenSourceController(
    private val displayOpenSourceQueryService: DisplayOpenSourceQueryService,
) {

    @GetMapping("/open-source")
    fun openSource(): ApiResponse<List<DisplayOpenSourceDto>> =
        ApiResponse.success(displayOpenSourceQueryService.activeItems())
}
