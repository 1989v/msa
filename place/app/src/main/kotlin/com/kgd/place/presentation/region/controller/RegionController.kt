package com.kgd.place.presentation.region.controller

import com.kgd.common.response.ApiResponse
import com.kgd.place.application.region.usecase.CreateRegionUseCase
import com.kgd.place.application.region.usecase.GetRegionUseCase
import com.kgd.place.domain.region.model.RegionLevel
import com.kgd.place.presentation.region.dto.BulkCreateRegionRequest
import com.kgd.place.presentation.region.dto.BulkCreateRegionResponse
import com.kgd.place.presentation.region.dto.CreateRegionRequest
import com.kgd.place.presentation.region.dto.RegionResponse
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

/**
 * 행정 지리 계층 조회/적재 (ADR-0056 Part 2). 조회는 public (탐색용).
 */
@RestController
@RequestMapping("/api/places/regions")
class RegionController(
    private val createRegionUseCase: CreateRegionUseCase,
    private val getRegionUseCase: GetRegionUseCase,
) {

    /**
     * 계층 탐색. `parentId` 가 있으면 자식 지역, 없으면 `level`(기본 CONTINENT) 단위 목록.
     */
    @GetMapping
    fun list(
        @RequestParam(required = false) level: RegionLevel?,
        @RequestParam(required = false) parentId: Long?,
    ): ApiResponse<List<RegionResponse>> {
        val views = when {
            parentId != null -> getRegionUseCase.findChildren(parentId)
            else -> getRegionUseCase.findByLevel(level ?: RegionLevel.CONTINENT)
        }
        return ApiResponse.success(views.map { RegionResponse.from(it) })
    }

    @GetMapping("/{id}")
    fun findById(@PathVariable id: Long): ApiResponse<RegionResponse> =
        ApiResponse.success(RegionResponse.from(getRegionUseCase.findById(id)))

    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping
    fun create(@Valid @RequestBody request: CreateRegionRequest): ApiResponse<RegionResponse> =
        ApiResponse.success(RegionResponse.from(createRegionUseCase.execute(request.toCommand())))

    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping("/bulk")
    fun createBulk(@Valid @RequestBody request: BulkCreateRegionRequest): ApiResponse<BulkCreateRegionResponse> {
        val results = createRegionUseCase.executeBulk(request.regions.map { it.toCommand() })
        return ApiResponse.success(BulkCreateRegionResponse.from(results))
    }
}
