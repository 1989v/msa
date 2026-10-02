package com.kgd.place.presentation.air.controller

import com.kgd.common.response.ApiResponse
import com.kgd.place.application.air.usecase.AirQualityUseCase
import com.kgd.place.application.air.usecase.SyncAirQualityUseCase
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotEmpty
import jakarta.validation.constraints.Pattern
import jakarta.validation.constraints.PositiveOrZero
import jakarta.validation.constraints.Size
import org.springframework.http.CacheControl
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.Duration
import java.time.LocalDateTime
import java.time.ZoneId

/**
 * 시군구 최근접 측정소 대기 (에어코리아 실시간 측정).
 *
 * - 조회 `GET /api/places/air?sigungu=` — 관광지 상세가 부른다. 레디스 캐시 경로다(ADR-0071 §10). 검색 색인·서버 렌더 본문에는 싣지 않는다.
 * - 적재 `PUT /internal/air/stations` · `/measurements` — 수집기(place-ingest)만. 게이트웨이가 `/internal` 을 라우팅하지 않는다.
 *   같은 요청을 다시 보내도 결과가 같다(키 upsert, 측정은 측정 시각이 같거나 새로울 때만 덮는다).
 */
@RestController
class AirQualityController(
    private val air: AirQualityUseCase,
    private val sync: SyncAirQualityUseCase,
) {

    /** 매시 측정이라 엣지가 10분 쥔다 (ADR-0105). 화면이 측정 시각을 함께 보인다 */
    @GetMapping("/api/places/air")
    fun air(@RequestParam sigungu: String): ResponseEntity<ApiResponse<AirQualityUseCase.Air>> =
        ResponseEntity.ok()
            .cacheControl(
                CacheControl.maxAge(Duration.ofSeconds(60)).cachePublic()
                    .sMaxAge(Duration.ofMinutes(10)).staleWhileRevalidate(Duration.ofMinutes(5)),
            )
            .body(ApiResponse.success(air.air(sigungu, LocalDateTime.now(KST))))

    @PutMapping("/internal/air/stations")
    fun stations(@Valid @RequestBody request: AirStationsRequest): ApiResponse<SyncAirQualityUseCase.StationsApplied> =
        ApiResponse.success(
            sync.applyStations(
                request.stations.map { SyncAirQualityUseCase.StationItem(it.stationName, it.latitude, it.longitude, it.itemRaw) },
                request.mappings.map { SyncAirQualityUseCase.MappingItem(it.sigunguCode, it.stationName, it.distanceM, it.attractions) },
            ),
        )

    @PutMapping("/internal/air/measurements")
    fun measurements(@Valid @RequestBody request: AirMeasurementsRequest): ApiResponse<SyncAirQualityUseCase.Applied> =
        ApiResponse.success(
            sync.applyMeasurements(request.items.map { SyncAirQualityUseCase.MeasurementItem(it.sidoName, it.stationName, it.dataTime, it.itemRaw) }),
        )

    companion object {
        private val KST: ZoneId = ZoneId.of("Asia/Seoul")

        /** 전국 측정소 672(2026-10-02) — 한 요청이다. */
        const val MAX_ROWS = 2_000

        /** 시군구 측정소 후보 — 2026-10-02 추정 약 1,600행(시군구당 중앙값 6 · 최대 21). */
        const val MAX_MAPPINGS = 5_000
    }
}

data class AirStationsRequest(
    @field:NotEmpty @field:Size(max = AirQualityController.MAX_ROWS) @field:Valid val stations: List<Station>,
    @field:Size(max = AirQualityController.MAX_MAPPINGS) @field:Valid val mappings: List<Mapping>,
) {
    data class Station(
        @field:NotBlank @field:Size(max = 40) val stationName: String,
        val latitude: Double,
        val longitude: Double,
        @field:NotBlank val itemRaw: String,
    )

    data class Mapping(
        @field:Pattern(regexp = "\\d{5}") val sigunguCode: String,
        @field:NotBlank @field:Size(max = 40) val stationName: String,
        @field:PositiveOrZero val distanceM: Int? = null,
        @field:PositiveOrZero val attractions: Int,
    )
}

data class AirMeasurementsRequest(
    @field:NotEmpty @field:Size(max = AirQualityController.MAX_ROWS) @field:Valid val items: List<Item>,
) {
    data class Item(
        @field:NotBlank @field:Size(max = 20) val sidoName: String,
        @field:NotBlank @field:Size(max = 40) val stationName: String,
        @field:Pattern(regexp = "\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}") val dataTime: String? = null,
        @field:NotBlank val itemRaw: String,
    )
}
