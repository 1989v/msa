package com.kgd.place.presentation.region.controller

import com.kgd.common.response.ApiResponse
import com.kgd.place.application.region.usecase.RegionVisitorRankingUseCase
import com.kgd.place.application.region.usecase.RegionVisitorUseCase
import com.kgd.place.application.region.usecase.SyncRegionVisitorsUseCase
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotEmpty
import jakarta.validation.constraints.Pattern
import jakarta.validation.constraints.Size
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController

/**
 * 지역 방문자 (한국관광공사 빅데이터).
 *
 * - 조회 `GET /api/places/administrative-regions/{code}/visitors` — 지역 허브가 부른다. 레디스 캐시 경로다(ADR-0071 §10).
 * - 시도 순위 `GET /api/places/administrative-regions/{sidoCode}/visitor-ranking` — 시도 페이지 「타지 방문자가 많은
 *   시군구」. 같은 레디스 경로다. 지금 시도가 아닌 코드는 400.
 * - 적재 `PUT /internal/regions/visitors` — 수집기(place-ingest)만. 게이트웨이가 `/internal` 을 라우팅하지 않는다.
 *   같은 요청을 다시 보내도 결과가 같다((수준, 지역, 날짜, 구분) 키 upsert).
 */
@RestController
class RegionVisitorController(
    private val visitors: RegionVisitorUseCase,
    private val sync: SyncRegionVisitorsUseCase,
    private val rankings: RegionVisitorRankingUseCase,
) {

    @GetMapping("/api/places/administrative-regions/{code}/visitors")
    fun trend(@PathVariable code: String): ApiResponse<RegionVisitorUseCase.Trend> = ApiResponse.success(visitors.trend(code))

    @GetMapping("/api/places/administrative-regions/{sidoCode}/visitor-ranking")
    fun ranking(@PathVariable sidoCode: String): ApiResponse<RegionVisitorRankingUseCase.Ranking> =
        ApiResponse.success(rankings.ranking(sidoCode))

    @PutMapping("/internal/regions/visitors")
    fun apply(@Valid @RequestBody request: RegionVisitorBulkRequest): ApiResponse<SyncRegionVisitorsUseCase.Applied> =
        ApiResponse.success(sync.apply(request.items.map { it.toItem() }))

    companion object {
        /** 수집기 `place_client.BULK_CHUNK` 와 같은 값. */
        const val MAX_BULK = 2_000
    }
}

/**
 * 수집기는 원천 행을 키 이름 그대로 보낸다 — 기초는 `signguCode`/`signguNm`, 광역은 `areaCode`/`areaNm`.
 */
data class RegionVisitorBulkRequest(
    @field:NotEmpty(message = "items 는 비어있을 수 없습니다")
    @field:Size(max = RegionVisitorController.MAX_BULK, message = "한 번에 2000건까지")
    @field:Valid
    val items: List<Item>,
) {
    data class Item(
        @field:Pattern(regexp = "SIDO|SIGUNGU") val regionLevel: String,
        val signguCode: String? = null,
        val signguNm: String? = null,
        val areaCode: String? = null,
        val areaNm: String? = null,
        @field:Pattern(regexp = "\\d{8}") val baseYmd: String,
        @field:NotBlank val touDivCd: String,
        @field:NotBlank val touNum: String,
        val touDivNm: String? = null,
        val daywkDivCd: String? = null,
        val daywkDivNm: String? = null,
    ) {
        fun toItem(): SyncRegionVisitorsUseCase.Item {
            val sido = regionLevel == "SIDO"
            val code = requireNotNull(if (sido) areaCode else signguCode) { "$regionLevel 행에 지역 코드가 없다" }
            return SyncRegionVisitorsUseCase.Item(
                level = regionLevel, regionCode = code, baseYmd = baseYmd, touDivCd = touDivCd, touNum = touNum,
                regionName = if (sido) areaNm else signguNm, touDivNm = touDivNm, daywkDivCd = daywkDivCd, daywkDivNm = daywkDivNm,
            )
        }
    }
}
