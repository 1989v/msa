package com.kgd.place.presentation.region.dto

import com.kgd.place.application.region.usecase.AdminRegionUseCase
import com.kgd.place.domain.region.model.AdminRegionLevel
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotEmpty
import jakarta.validation.constraints.Size

data class BulkUpsertAdminRegionRequest(
    @field:NotEmpty(message = "행정구역 목록은 비어있을 수 없습니다")
    @field:Size(max = 2000, message = "한 번에 최대 2000건까지 적재할 수 있습니다")
    @field:Valid
    val regions: List<Item>,
) {
    data class Item(
        @field:NotBlank val code: String,
        val level: AdminRegionLevel,
        @field:NotBlank val name: String,
        val parentCode: String? = null,
        val nameEn: String? = null,
        val latitude: Double? = null,
        val longitude: Double? = null,
    ) {
        fun toCommand() = AdminRegionUseCase.Command(
            code = code,
            level = level,
            name = name,
            parentCode = parentCode,
            nameEn = nameEn,
            latitude = latitude,
            longitude = longitude,
        )
    }
}

data class AdminRegionResponse(
    val code: String,
    val parentCode: String?,
    val level: String,
    val name: String,
    val nameEn: String?,
    val latitude: Double?,
    val longitude: Double?,
) {
    companion object {
        fun from(view: AdminRegionUseCase.View) = AdminRegionResponse(
            code = view.code,
            parentCode = view.parentCode,
            level = view.level.name,
            name = view.name,
            nameEn = view.nameEn,
            latitude = view.latitude,
            longitude = view.longitude,
        )
    }
}

data class AdminRegionListResponse(val regions: List<AdminRegionResponse>)

data class BulkUpsertAdminRegionResponse(val created: Int, val updated: Int)
