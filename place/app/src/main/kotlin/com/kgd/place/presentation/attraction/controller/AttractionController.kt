package com.kgd.place.presentation.attraction.controller

import com.kgd.common.response.ApiResponse
import com.kgd.place.application.attraction.usecase.AttractionOverviewProbeUseCase
import com.kgd.place.application.attraction.usecase.GetAttractionLinksUseCase
import com.kgd.place.application.attraction.usecase.GetAttractionUseCase
import com.kgd.place.application.attraction.usecase.UpsertAttractionUseCase
import com.kgd.place.presentation.attraction.dto.AttractionLinksResponse
import com.kgd.place.presentation.attraction.dto.AttractionPageResponse
import com.kgd.place.presentation.attraction.dto.AttractionResponse
import com.kgd.place.presentation.attraction.dto.BulkUpsertAttractionRequest
import com.kgd.place.presentation.attraction.dto.BulkUpsertAttractionResponse
import com.kgd.place.presentation.attraction.dto.OverviewProbeListResponse
import com.kgd.place.presentation.attraction.dto.RecordOverviewProbeRequest
import com.kgd.place.presentation.attraction.dto.RecordOverviewProbeResponse
import jakarta.validation.Valid
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

/**
 * 관광지 적재(ADMIN) + 페이지 조회 (ADR-0065). 페이지 조회는 search-batch 재색인 풀스캔이 사용한다.
 */
@RestController
@RequestMapping("/api/places/attractions")
class AttractionController(
    private val upsertAttractionUseCase: UpsertAttractionUseCase,
    private val getAttractionUseCase: GetAttractionUseCase,
    private val overviewProbeUseCase: AttractionOverviewProbeUseCase,
    private val getAttractionLinksUseCase: GetAttractionLinksUseCase,
) {

    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping("/bulk")
    fun upsertBulk(
        @Valid @RequestBody request: BulkUpsertAttractionRequest,
    ): ApiResponse<BulkUpsertAttractionResponse> {
        val result = upsertAttractionUseCase.executeBulk(request.attractions.map { it.toCommand() })
        return ApiResponse.success(BulkUpsertAttractionResponse.from(result))
    }

    @GetMapping
    fun findPage(
        @RequestParam(required = false) lang: String?,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
    ): ApiResponse<AttractionPageResponse> {
        val pageable = PageRequest.of(page.coerceAtLeast(0), size.coerceIn(1, 200), Sort.by("id"))
        val result = getAttractionUseCase.findPage(lang, pageable)
        return ApiResponse.success(
            AttractionPageResponse(
                attractions = result.content.map { AttractionResponse.from(it) },
                totalElements = result.totalElements,
                totalPages = result.totalPages,
                currentPage = result.number,
            )
        )
    }

    @GetMapping("/{id}")
    fun findById(@PathVariable id: Long): ApiResponse<AttractionResponse> =
        ApiResponse.success(AttractionResponse.from(getAttractionUseCase.findById(id)))

    /** 관광지 외부 링크 (ADR-0070) — 지금은 조립되는 딥링크만. 수집형은 커넥터가 붙을 때 더해진다. */
    @GetMapping("/{id}/links")
    fun findLinks(@PathVariable id: Long): ApiResponse<AttractionLinksResponse> =
        ApiResponse.success(AttractionLinksResponse.from(getAttractionLinksUseCase.findByAttractionId(id)))

    /**
     * 개요 수집 negative cache (ADR-0070). 수집기가 제외 목록을 받아 가고, 원천이 빈 개요를 준
     * 레코드를 남긴다. 조회는 공개(내용이 contentId 목록뿐), 기록은 게이트웨이가 ADMIN 으로 막는다.
     */
    @GetMapping("/overview-probes")
    fun findOverviewProbes(
        @RequestParam(required = false) lang: String?,
    ): ApiResponse<OverviewProbeListResponse> {
        val keys = overviewProbeUseCase.findKeys(lang)
        return ApiResponse.success(OverviewProbeListResponse(keys = keys, total = keys.size))
    }

    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping("/overview-probes")
    fun recordOverviewProbes(
        @Valid @RequestBody request: RecordOverviewProbeRequest,
    ): ApiResponse<RecordOverviewProbeResponse> =
        ApiResponse.success(
            RecordOverviewProbeResponse(overviewProbeUseCase.record(request.probes.map { it.toCommand() })),
        )
}
