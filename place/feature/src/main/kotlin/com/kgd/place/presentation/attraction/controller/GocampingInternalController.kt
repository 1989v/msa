package com.kgd.place.presentation.attraction.controller

import com.kgd.common.response.ApiResponse
import com.kgd.place.application.attraction.usecase.SyncGocampingUseCase
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotEmpty
import jakarta.validation.constraints.Size
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDateTime

/**
 * 고캠핑 원천 표 적재 — 수집기(place-ingest)만 부른다. 게이트웨이가 라우팅하지 않는 `/internal` 이다.
 * PUT — 같은 요청을 다시 보내도 결과가 같다(원천 contentId 가 기본키).
 */
@RestController
@RequestMapping("/internal/attractions/gocamping")
class GocampingInternalController(
    private val gocamping: SyncGocampingUseCase,
) {
    @PutMapping
    fun upsert(@Valid @RequestBody request: GocampingRequest): ApiResponse<SyncGocampingUseCase.Applied> =
        ApiResponse.success(
            gocamping.upsert(
                request.items.map {
                    SyncGocampingUseCase.Item(
                        it.contentId, it.facilityName, it.manageStatus, it.latitude, it.longitude, it.itemRaw,
                        it.matchedAttractionId, it.matchMethod, it.syncedAt,
                    )
                },
            ),
        )
}

data class GocampingRequest(
    @field:NotEmpty
    @field:Size(max = 2_000, message = "한 번에 2000건까지")
    @field:Valid
    val items: List<Item>,
) {
    data class Item(
        @field:NotBlank val contentId: String,
        @field:NotBlank val facilityName: String,
        val manageStatus: String? = null,
        val latitude: Double? = null,
        val longitude: Double? = null,
        @field:NotBlank val itemRaw: String,
        val matchedAttractionId: Long? = null,
        val matchMethod: String? = null,
        val syncedAt: LocalDateTime,
    )
}
