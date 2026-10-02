package com.kgd.place.presentation.attraction.controller

import com.kgd.common.response.ApiResponse
import com.kgd.place.application.attraction.usecase.LookupAttractionExtrasUseCase
import com.kgd.place.application.attraction.usecase.SyncAttractionBarrierFreeUseCase
import com.kgd.place.application.attraction.usecase.SyncAttractionWellnessUseCase
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotEmpty
import jakarta.validation.constraints.Size
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDateTime

/**
 * 관광지에 붙는 2단계 공공데이터(무장애 · 웰니스) — 수집기(place-ingest)가 쓰고 재색인(search-batch)이 읽는다.
 * 비슷한 곳·링크와 같은 이유로 `/internal` 이다 — 게이트웨이가 라우팅하지 않아 클러스터 밖에서 닿지 않는다.
 * 화면은 이 경로를 부르지 않는다 — 값은 재색인 문서로 나간다 (ADR-0071 §10).
 *
 * 적재는 모두 PUT — 같은 요청을 다시 보내도 결과가 같다(수집기의 재시도가 안전하다).
 */
@RestController
@RequestMapping("/internal/attractions")
class AttractionExtrasInternalController(
    private val barrierFree: SyncAttractionBarrierFreeUseCase,
    private val wellness: SyncAttractionWellnessUseCase,
    private val lookupExtras: LookupAttractionExtrasUseCase,
) {

    @PutMapping("/barrier-free/list")
    fun barrierFreeList(@Valid @RequestBody request: BarrierFreeListRequest): ApiResponse<SyncAttractionBarrierFreeUseCase.ListApplied> =
        ApiResponse.success(
            barrierFree.applyList(
                request.items.map { SyncAttractionBarrierFreeUseCase.ListItem(it.contentId, it.listRaw, it.listModifiedAt) },
            ),
        )

    @GetMapping("/barrier-free/state")
    fun barrierFreeState(): ApiResponse<BarrierFreeStateResponse> =
        ApiResponse.success(BarrierFreeStateResponse(barrierFree.states()))

    @PutMapping("/barrier-free/details")
    fun barrierFreeDetails(@Valid @RequestBody request: BarrierFreeDetailRequest): ApiResponse<AppliedResponse> =
        ApiResponse.success(
            AppliedResponse(
                barrierFree.applyDetails(
                    request.items.map {
                        SyncAttractionBarrierFreeUseCase.DetailItem(it.contentId, it.detailRaw, it.flags, it.flagsRuleVer, it.detailSyncedAt)
                    },
                ),
            ),
        )

    @PutMapping("/wellness")
    fun wellness(@Valid @RequestBody request: WellnessRequest): ApiResponse<SyncAttractionWellnessUseCase.Applied> =
        ApiResponse.success(
            wellness.replace(request.lang, request.items.map { SyncAttractionWellnessUseCase.Item(it.contentId, it.themaCd, it.listRaw) }),
        )

    @PostMapping("/extras/lookup")
    fun lookup(@Valid @RequestBody request: ExtrasLookupRequest): ApiResponse<ExtrasLookupResponse> =
        ApiResponse.success(ExtrasLookupResponse(lookupExtras.lookup(request.ids)))

    companion object {
        /** 수집기 `place_client.BULK_CHUNK` 와 같은 값. */
        const val MAX_BULK = 2_000

        /** 재색인(`PlaceApiClient.LOOKUP_MAX_BATCH`)과 같은 값. */
        const val MAX_LOOKUP = 500
    }
}

data class BarrierFreeListRequest(
    @field:NotEmpty(message = "items 는 비어있을 수 없습니다")
    @field:Size(max = AttractionExtrasInternalController.MAX_BULK, message = "한 번에 2000건까지")
    val items: List<Item>,
) {
    data class Item(
        @field:NotBlank val contentId: String,
        /** 목록 행 원문(JSON) — 그대로 저장한다. */
        @field:NotBlank val listRaw: String,
        val listModifiedAt: LocalDateTime? = null,
    )
}

data class BarrierFreeDetailRequest(
    @field:NotEmpty(message = "items 는 비어있을 수 없습니다")
    @field:Size(max = AttractionExtrasInternalController.MAX_BULK, message = "한 번에 2000건까지")
    val items: List<Item>,
) {
    /** [detailRaw] 가 null 이면 원천이 빈 상세를 준 것이다 — 받은 시각만 남는다. */
    data class Item(
        @field:NotBlank val contentId: String,
        val detailRaw: String? = null,
        val flags: List<String> = emptyList(),
        val flagsRuleVer: Int,
        val detailSyncedAt: LocalDateTime,
    )
}

data class BarrierFreeStateResponse(val items: List<SyncAttractionBarrierFreeUseCase.State>)

data class AppliedResponse(val applied: Int)

data class WellnessRequest(
    @field:NotBlank val lang: String,
    @field:NotEmpty(message = "items 는 비어있을 수 없습니다")
    @field:Size(max = AttractionExtrasInternalController.MAX_BULK, message = "한 번에 2000건까지")
    val items: List<Item>,
) {
    data class Item(@field:NotBlank val contentId: String, @field:NotBlank val themaCd: String, @field:NotBlank val listRaw: String)
}

data class ExtrasLookupRequest(
    @field:NotEmpty(message = "ids 는 비어있을 수 없습니다")
    @field:Size(max = AttractionExtrasInternalController.MAX_LOOKUP, message = "한 번에 500건까지")
    val ids: List<Long>,
)

data class ExtrasLookupResponse(val items: List<LookupAttractionExtrasUseCase.Found>)
