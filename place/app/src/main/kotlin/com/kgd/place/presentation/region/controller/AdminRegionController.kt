package com.kgd.place.presentation.region.controller

import com.kgd.common.response.ApiResponse
import com.kgd.place.application.region.usecase.AdminRegionUseCase
import com.kgd.place.domain.region.model.AdminRegionLevel
import com.kgd.place.presentation.region.dto.AdminRegionListResponse
import com.kgd.place.presentation.region.dto.AdminRegionResponse
import com.kgd.place.presentation.region.dto.BulkUpsertAdminRegionRequest
import com.kgd.place.presentation.region.dto.BulkUpsertAdminRegionResponse
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

/**
 * 행정구역 (ADR-0071). 조회는 공개(탐색), 적재는 게이트웨이가 ADMIN 으로 막는다 —
 * `/api/places` 이하의 GET/write 분리 규칙을 그대로 탄다.
 * (KDoc 안에 `places/`+`**` 를 쓰면 Kotlin 이 중첩 블록 주석 시작으로 읽어 파일이 안 닫힌다.)
 */
@RestController
@RequestMapping("/api/places/admin-regions")
class AdminRegionController(
    private val adminRegionUseCase: AdminRegionUseCase,
) {

    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping("/bulk")
    fun upsertBulk(
        @Valid @RequestBody request: BulkUpsertAdminRegionRequest,
    ): ApiResponse<BulkUpsertAdminRegionResponse> {
        val result = adminRegionUseCase.upsertAll(request.regions.map { it.toCommand() })
        return ApiResponse.success(BulkUpsertAdminRegionResponse(result.created, result.updated))
    }

    /** `parent` 를 주면 그 시도의 시군구, 없으면 시도 전체. */
    @GetMapping
    fun find(
        @RequestParam(defaultValue = "SIDO") level: AdminRegionLevel,
        @RequestParam(required = false) parent: String?,
    ): ApiResponse<AdminRegionListResponse> =
        ApiResponse.success(
            AdminRegionListResponse(
                adminRegionUseCase.find(level, parent).map { AdminRegionResponse.from(it) },
            ),
        )
}
