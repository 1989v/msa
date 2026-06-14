package com.kgd.place.presentation.poi.dto

import jakarta.validation.Valid
import jakarta.validation.constraints.NotEmpty
import jakarta.validation.constraints.Size

data class BulkCreatePoiRequest(
    @field:NotEmpty(message = "POI 목록은 비어있을 수 없습니다")
    @field:Size(max = 2000, message = "한 번에 최대 2000건까지 적재할 수 있습니다")
    @field:Valid
    val pois: List<CreatePoiRequest>,
)
