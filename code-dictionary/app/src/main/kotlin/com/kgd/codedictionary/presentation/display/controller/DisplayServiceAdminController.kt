package com.kgd.codedictionary.presentation.display.controller

import com.kgd.codedictionary.application.display.dto.DisplayServiceDto
import com.kgd.codedictionary.application.display.dto.DisplayServiceUpsertRequest
import com.kgd.codedictionary.application.display.service.DisplayAdminService
import com.kgd.common.response.ApiResponse
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * 메인 전시 관리 API (ADR-0066).
 *
 * 인증은 게이트웨이의 admin 경로 ROLE_ADMIN 필터가 담당한다.
 */
@RestController
@RequestMapping("/api/v1/admin/display")
class DisplayServiceAdminController(
    private val adminService: DisplayAdminService,
) {

    @GetMapping("/services")
    fun services(): ApiResponse<List<DisplayServiceDto>> =
        ApiResponse.success(adminService.allServices())

    @PutMapping("/services")
    fun upsert(@RequestBody request: DisplayServiceUpsertRequest): ApiResponse<DisplayServiceDto> =
        ApiResponse.success(adminService.upsert(request))

    @DeleteMapping("/services/{id}")
    fun delete(@PathVariable id: Long): ApiResponse<Unit> {
        adminService.delete(id)
        return ApiResponse.success(Unit)
    }
}
