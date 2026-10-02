package com.kgd.place.presentation.attraction.controller

import com.kgd.common.response.ApiResponse
import com.kgd.place.application.attraction.usecase.SyncAttractionCongestionUseCase
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotEmpty
import jakarta.validation.constraints.Size
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDate

/**
 * 관광지 집중률 적재 — 수집기(place-ingest)만 부른다. 무장애·웰니스와 같은 이유로 `/internal` 이다(게이트웨이가 라우팅하지 않는다).
 * 재색인은 이 값을 `/internal/attractions/extras/lookup` 묶음 조회로 읽는다 — 화면은 이 경로를 부르지 않는다 (ADR-0071 §10).
 * PUT — 같은 요청을 다시 보내도 결과가 같다.
 */
@RestController
@RequestMapping("/internal/attractions/congestion")
class AttractionCongestionInternalController(
    private val congestion: SyncAttractionCongestionUseCase,
) {

    @PutMapping("/{signguCd}")
    fun replace(
        @PathVariable signguCd: String,
        @Valid @RequestBody request: CongestionRequest,
    ): ApiResponse<SyncAttractionCongestionUseCase.Applied> =
        ApiResponse.success(
            congestion.replaceSigungu(
                signguCd,
                request.items.map {
                    SyncAttractionCongestionUseCase.Item(
                        it.tAtsNm, it.areaCd, it.areaNm, it.signguNm, it.ratesRaw, it.firstYmd, it.lastYmd, it.attractionId, it.matchMethod,
                    )
                },
            ),
        )

    companion object {
        /** 한 시군구의 관광지 수 상한 — 실측 최대는 제주시 244곳(2026-10-02). */
        const val MAX_ITEMS = 2_000
    }
}

data class CongestionRequest(
    @field:NotEmpty(message = "items 는 비어있을 수 없습니다")
    @field:Size(max = AttractionCongestionInternalController.MAX_ITEMS, message = "한 번에 2000건까지")
    val items: List<Item>,
) {
    /** 수집기 `congestion.record` 가 만드는 모양 그대로. 날짜는 `yyyy-MM-dd`. */
    data class Item(
        @field:NotBlank val tAtsNm: String,
        @field:NotBlank val areaCd: String,
        val areaNm: String? = null,
        val signguNm: String? = null,
        /** 원천 행 배열 원문(JSON) — 그대로 저장한다. */
        @field:NotBlank val ratesRaw: String,
        val firstYmd: LocalDate,
        val lastYmd: LocalDate,
        val attractionId: Long? = null,
        @field:NotBlank val matchMethod: String,
    )
}
