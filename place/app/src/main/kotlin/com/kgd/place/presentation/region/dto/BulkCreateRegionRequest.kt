package com.kgd.place.presentation.region.dto

import jakarta.validation.Valid
import jakarta.validation.constraints.NotEmpty
import jakarta.validation.constraints.Size

data class BulkCreateRegionRequest(
    @field:NotEmpty(message = "지역 목록은 비어있을 수 없습니다")
    @field:Size(max = 5000, message = "한 번에 최대 5000건까지 적재할 수 있습니다")
    @field:Valid
    val regions: List<CreateRegionRequest>,
)
