package com.kgd.place.presentation.attraction.controller

import com.kgd.common.response.ApiResponse
import com.kgd.place.application.attraction.usecase.SyncAttractionRelatedUseCase
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotEmpty
import jakarta.validation.constraints.Pattern
import jakarta.validation.constraints.Size
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * 연관 관광지 적재 — 수집기(place-ingest)만 부른다. 집중률과 같은 이유로 `/internal` 이다(게이트웨이가 라우팅하지 않는다).
 * 재색인은 이 값을 `/internal/attractions/extras/lookup` 묶음 조회로 읽는다 — 화면은 이 경로를 부르지 않는다 (ADR-0071 §10).
 * PUT — 같은 요청을 다시 보내도 결과가 같다.
 */
@RestController
@RequestMapping("/internal/attractions/related")
class AttractionRelatedInternalController(
    private val related: SyncAttractionRelatedUseCase,
) {

    @PutMapping("/{signguCd}")
    fun replace(
        @PathVariable signguCd: String,
        @Valid @RequestBody request: RelatedRequest,
    ): ApiResponse<SyncAttractionRelatedUseCase.Applied> =
        ApiResponse.success(
            related.replaceSigungu(
                signguCd,
                request.baseYm,
                request.items.map { item ->
                    SyncAttractionRelatedUseCase.Item(
                        item.tAtsCd, item.tAtsNm, item.relatedRaw, item.attractionId, item.matchMethod,
                        item.targets.map {
                            SyncAttractionRelatedUseCase.Target(
                                it.rank, it.name, it.lcls, it.mcls, it.scls, it.signguCd, it.attractionId, it.matchMethod,
                            )
                        },
                    )
                },
            ),
        )

    /** 시군구별 가진 최신 기준 월 — 수집기가 이미 받은 달을 다시 부르지 않으려고 읽는다. */
    @GetMapping("/state")
    fun state(): ApiResponse<RelatedStateResponse> = ApiResponse.success(RelatedStateResponse(related.state()))

    companion object {
        /** 한 시군구의 출발 관광지 수 상한 — 실측 최대는 제주시 155곳(202608). */
        const val MAX_ITEMS = 2_000

        /** 출발 관광지 하나의 대상 수 상한 — 원천이 최대 50을 준다. */
        const val MAX_TARGETS = 200
    }
}

data class RelatedRequest(
    @field:Pattern(regexp = "\\d{4}(0[1-9]|1[0-2])", message = "baseYm 은 yyyyMM 입니다")
    val baseYm: String,
    @field:NotEmpty(message = "items 는 비어있을 수 없습니다")
    @field:Size(max = AttractionRelatedInternalController.MAX_ITEMS, message = "한 번에 2000건까지")
    val items: List<Item>,
) {
    /** 수집기 `related.record` 가 만드는 모양 그대로. */
    data class Item(
        @field:NotBlank val tAtsCd: String,
        @field:NotBlank val tAtsNm: String,
        /** 원천 행 배열 원문(JSON) — 그대로 저장한다. */
        @field:NotBlank val relatedRaw: String,
        val attractionId: Long? = null,
        @field:NotBlank val matchMethod: String,
        @field:Size(max = AttractionRelatedInternalController.MAX_TARGETS)
        val targets: List<Target> = emptyList(),
    )

    data class Target(
        val rank: Int,
        @field:NotBlank val name: String,
        val lcls: String? = null,
        val mcls: String? = null,
        val scls: String? = null,
        val signguCd: String? = null,
        val attractionId: Long? = null,
        @field:NotBlank val matchMethod: String,
    )
}

data class RelatedStateResponse(val sigungu: Map<String, String>)
