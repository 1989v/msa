package com.kgd.place.presentation.poi.controller

import com.kgd.common.response.ApiResponse
import com.kgd.place.application.poi.usecase.CreatePoiUseCase
import com.kgd.place.application.poi.usecase.NearbyPoiUseCase
import com.kgd.place.presentation.poi.dto.BulkCreatePoiRequest
import com.kgd.place.presentation.poi.dto.BulkCreatePoiResponse
import com.kgd.place.presentation.poi.dto.CreatePoiRequest
import com.kgd.place.presentation.poi.dto.NearbyPoiResponse
import com.kgd.place.presentation.poi.dto.PoiResponse
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

/**
 * POI 적재 + 근처검색 (ADR-0056 Part 2). nearby 조회는 public (탐색).
 */
@RestController
@RequestMapping("/api/places")
class PoiController(
    private val createPoiUseCase: CreatePoiUseCase,
    private val nearbyPoiUseCase: NearbyPoiUseCase,
) {

    /**
     * 주변 POI 검색 — 중심 좌표(lat,lng) 반경 radiusKm 내, 거리 오름차순.
     * 예: GET /api/places/nearby?lat=37.5172&lng=127.0473&radiusKm=2&category=음식
     */
    @GetMapping("/nearby")
    fun nearby(
        @RequestParam lat: Double,
        @RequestParam lng: Double,
        @RequestParam(defaultValue = "2.0") radiusKm: Double,
        @RequestParam(required = false) category: String?,
        @RequestParam(required = false) keyword: String?,
        @RequestParam(defaultValue = "20") size: Int,
    ): ApiResponse<List<NearbyPoiResponse>> {
        val results = nearbyPoiUseCase.nearby(
            NearbyPoiUseCase.Query(
                latitude = lat,
                longitude = lng,
                radiusKm = radiusKm.coerceIn(0.1, 50.0),
                category = category,
                keyword = keyword,
                size = size.coerceIn(1, 100),
            )
        )
        return ApiResponse.success(results.map { NearbyPoiResponse.from(it) })
    }

    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping("/pois")
    fun create(@Valid @RequestBody request: CreatePoiRequest): ApiResponse<PoiResponse> =
        ApiResponse.success(PoiResponse.from(createPoiUseCase.execute(request.toCommand())))

    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping("/pois/bulk")
    fun createBulk(@Valid @RequestBody request: BulkCreatePoiRequest): ApiResponse<BulkCreatePoiResponse> {
        val results = createPoiUseCase.executeBulk(request.pois.map { it.toCommand() })
        return ApiResponse.success(BulkCreatePoiResponse.from(results))
    }
}
