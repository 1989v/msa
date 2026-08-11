package com.kgd.codedictionary.presentation.portal.controller

import com.kgd.codedictionary.application.portal.dto.PortalTileDto
import com.kgd.codedictionary.application.portal.dto.PortalTileUpsertRequest
import com.kgd.codedictionary.application.portal.service.PortalTileAdminService
import com.kgd.common.response.ApiResponse
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * 메인 타일 관리 API (ADR-0066).
 *
 * 인증은 게이트웨이의 admin 경로 ROLE_ADMIN 필터가 담당한다.
 */
@RestController
@RequestMapping("/api/v1/admin/portal")
class PortalTileAdminController(
    private val adminService: PortalTileAdminService,
) {

    @GetMapping("/tiles")
    fun tiles(): ApiResponse<List<PortalTileDto>> =
        ApiResponse.success(adminService.allTiles())

    @PutMapping("/tiles")
    fun upsert(@RequestBody request: PortalTileUpsertRequest): ApiResponse<PortalTileDto> =
        ApiResponse.success(adminService.upsert(request))

    @DeleteMapping("/tiles/{id}")
    fun delete(@PathVariable id: Long): ApiResponse<Unit> {
        adminService.delete(id)
        return ApiResponse.success(Unit)
    }
}
