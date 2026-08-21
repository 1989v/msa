package com.kgd.place.presentation.attraction.controller

import com.kgd.common.response.ApiResponse
import com.kgd.place.application.attraction.usecase.CollectGooglePlaceIdsUseCase
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotEmpty
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/**
 * 구글 place_id 수집기 전용 경로 — AttractionLinkInternalController 와 같은 `/internal` 패턴.
 * 게이트웨이는 `/api`·`/sse`·`/ws`·`/actuator` 만 받으므로 클러스터 밖에서 닿지 않는다 (ADR-0061).
 */
@RestController
@RequestMapping("/internal/attractions/google-place-ids")
class AttractionGooglePlaceInternalController(
    private val collectGooglePlaceIdsUseCase: CollectGooglePlaceIdsUseCase,
) {

    /** place_id 미보강분 id 순 — 일일 예산은 수집기의 환경변수가 정한다 (ID-only 무과금 SKU). */
    @GetMapping("/pending")
    fun findPending(
        @RequestParam(required = false) lang: String?,
        @RequestParam(defaultValue = "1000") limit: Int,
    ): ApiResponse<PendingGooglePlacesResponse> {
        val items = collectGooglePlaceIdsUseCase.findPending(lang, limit.coerceIn(1, 2000))
        return ApiResponse.success(
            PendingGooglePlacesResponse(
                items = items.map {
                    PendingGooglePlaceItem(it.attractionId, it.title, it.lang, it.address)
                },
            ),
        )
    }

    /**
     * 찾은 id 만 온다 — 검색 0건은 항목 자체가 없다. null 로 남은 행은 다음 실행이 다시
     * 시도한다 (무과금 호출이고 구글 색인은 자라므로, negative cache 를 두지 않는 선택이다).
     */
    @PostMapping("/bulk")
    fun applyResults(
        @Valid @RequestBody request: ApplyGooglePlaceIdsRequest,
    ): ApiResponse<ApplyGooglePlaceIdsResponse> {
        val applied = collectGooglePlaceIdsUseCase.apply(request.results.map { it.toResult() })
        return ApiResponse.success(ApplyGooglePlaceIdsResponse(applied))
    }
}

data class PendingGooglePlacesResponse(val items: List<PendingGooglePlaceItem>)

data class PendingGooglePlaceItem(
    val attractionId: Long,
    val title: String,
    val lang: String,
    val address: String?,
)

data class ApplyGooglePlaceIdsRequest(
    @field:NotEmpty(message = "results 는 비어있을 수 없습니다")
    @field:Valid
    val results: List<Item>,
) {
    data class Item(
        val attractionId: Long,
        @field:NotBlank(message = "googlePlaceId 는 필수입니다")
        val googlePlaceId: String,
    ) {
        fun toResult() = CollectGooglePlaceIdsUseCase.Result(
            attractionId = attractionId,
            googlePlaceId = googlePlaceId,
        )
    }
}

data class ApplyGooglePlaceIdsResponse(val applied: Int)
