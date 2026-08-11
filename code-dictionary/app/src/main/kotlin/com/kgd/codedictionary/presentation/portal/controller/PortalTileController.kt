package com.kgd.codedictionary.presentation.portal.controller

import com.kgd.codedictionary.application.portal.dto.PortalTileDto
import com.kgd.codedictionary.application.portal.service.PortalTileService
import com.kgd.common.response.ApiResponse
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/** 1989v.com 메인의 도메인 타일 (ADR-0066). HIDDEN 은 응답에 포함되지 않는다. */
@RestController
@RequestMapping("/api/v1/portal")
class PortalTileController(
    private val portalTileService: PortalTileService,
) {

    @GetMapping("/tiles")
    fun tiles(): ApiResponse<List<PortalTileDto>> =
        ApiResponse.success(portalTileService.visibleTiles())
}
