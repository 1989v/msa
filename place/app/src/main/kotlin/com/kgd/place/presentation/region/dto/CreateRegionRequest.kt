package com.kgd.place.presentation.region.dto

import com.kgd.place.application.region.usecase.CreateRegionUseCase
import com.kgd.place.domain.region.model.RegionLevel
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull

data class CreateRegionRequest(
    @field:NotNull(message = "레벨은 필수입니다")
    val level: RegionLevel,
    @field:NotBlank(message = "지역명은 필수입니다")
    val name: String,
    val parentId: Long? = null,
    val nameKo: String? = null,
    val countryCode: String? = null,
    val admin1Code: String? = null,
    val admin2Code: String? = null,
    val geonamesId: Long? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val population: Long? = null,
) {
    fun toCommand() = CreateRegionUseCase.Command(
        level = level,
        name = name,
        parentId = parentId,
        nameKo = nameKo,
        countryCode = countryCode,
        admin1Code = admin1Code,
        admin2Code = admin2Code,
        geonamesId = geonamesId,
        latitude = latitude,
        longitude = longitude,
        population = population,
    )
}
