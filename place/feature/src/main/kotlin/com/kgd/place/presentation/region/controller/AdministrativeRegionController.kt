package com.kgd.place.presentation.region.controller

import com.kgd.common.response.ApiResponse
import com.kgd.place.application.region.usecase.AdministrativeRegionUseCase
import com.kgd.place.domain.region.model.AdministrativeRegionLevel
import com.kgd.place.presentation.region.dto.AdministrativeRegionListResponse
import com.kgd.place.presentation.region.dto.AdministrativeRegionResponse
import com.kgd.place.presentation.region.dto.BulkUpsertAdministrativeRegionRequest
import com.kgd.place.presentation.region.dto.BulkUpsertAdministrativeRegionResponse
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
@RequestMapping("/api/places/administrative-regions")
class AdministrativeRegionController(
    private val administrativeRegionUseCase: AdministrativeRegionUseCase,
) {

    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping("/bulk")
    fun upsertBulk(
        @Valid @RequestBody request: BulkUpsertAdministrativeRegionRequest,
    ): ApiResponse<BulkUpsertAdministrativeRegionResponse> {
        val result = administrativeRegionUseCase.upsertAll(request.regions.map { it.toCommand() })
        return ApiResponse.success(BulkUpsertAdministrativeRegionResponse(result.created, result.updated))
    }

    /**
     * `parent` 를 주면 그 시도의 시군구, 없으면 시도 전체.
     * `lang` 을 주면 그 언어의 **관광 분류** 건수를 함께 낸다 — 음식·쇼핑까지 세면
     * "제주 12,000곳" 같은 수가 나와 기대와 어긋난다.
     */
    @GetMapping
    fun find(
        @RequestParam(defaultValue = "SIDO") level: AdministrativeRegionLevel,
        @RequestParam(required = false) parent: String?,
        @RequestParam(required = false) lang: String?,
    ): ApiResponse<AdministrativeRegionListResponse> =
        ApiResponse.success(
            AdministrativeRegionListResponse(
                administrativeRegionUseCase.find(level, parent, lang?.takeIf { it.isNotBlank() })
                    .map { AdministrativeRegionResponse.from(it) },
            ),
        )
}
