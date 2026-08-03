package com.kgd.place.presentation.poi.dto

import com.kgd.place.application.poi.usecase.CreatePoiUseCase
import jakarta.validation.constraints.NotBlank

data class CreatePoiRequest(
    @field:NotBlank(message = "source 는 필수입니다")
    val source: String,
    @field:NotBlank(message = "sourceKey 는 필수입니다")
    val sourceKey: String,
    @field:NotBlank(message = "POI 명은 필수입니다")
    val name: String,
    val latitude: Double,
    val longitude: Double,
    val categoryMajor: String? = null,
    val categoryMid: String? = null,
    val categorySub: String? = null,
    val regionId: Long? = null,
    val roadAddress: String? = null,
    val jibunAddress: String? = null,
) {
    fun toCommand() = CreatePoiUseCase.Command(
        source = source,
        sourceKey = sourceKey,
        name = name,
        latitude = latitude,
        longitude = longitude,
        categoryMajor = categoryMajor,
        categoryMid = categoryMid,
        categorySub = categorySub,
        regionId = regionId,
        roadAddress = roadAddress,
        jibunAddress = jibunAddress,
    )
}
