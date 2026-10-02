package com.kgd.place.presentation.weather.controller

import com.kgd.common.response.ApiResponse
import com.kgd.place.application.weather.usecase.SyncWeatherUseCase
import com.kgd.place.application.weather.usecase.WeatherUseCase
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotEmpty
import jakarta.validation.constraints.Pattern
import jakarta.validation.constraints.Size
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDateTime
import java.time.ZoneId

/**
 * 시군구 날씨 (기상청 단기예보 · 중기예보).
 *
 * - 조회 `GET /api/places/weather?sigungu=` — 관광지 상세가 부른다. 레디스 캐시 경로다(ADR-0071 §10). 검색 색인·서버 렌더 본문에는 싣지 않는다.
 * - 적재 `PUT /internal/weather/areas` · `/short` · `/mid` — 수집기(place-ingest)만. 게이트웨이가 `/internal` 을 라우팅하지 않는다.
 *   같은 요청을 다시 보내도 결과가 같다(키 upsert, 예보는 발표 시각이 같거나 새로울 때만 덮는다).
 */
@RestController
class WeatherController(
    private val weather: WeatherUseCase,
    private val sync: SyncWeatherUseCase,
) {

    @GetMapping("/api/places/weather")
    fun outlook(@RequestParam sigungu: String): ApiResponse<WeatherUseCase.Outlook> =
        ApiResponse.success(weather.outlook(sigungu, LocalDateTime.now(KST)))

    @PutMapping("/internal/weather/areas")
    fun areas(@Valid @RequestBody request: WeatherAreasRequest): ApiResponse<SyncWeatherUseCase.AreasApplied> =
        ApiResponse.success(
            sync.applyAreas(
                request.midRegions.map { SyncWeatherUseCase.MidRegionItem(it.regId, it.kind, it.name) },
                request.areas.map { SyncWeatherUseCase.AreaItem(it.sigunguCode, it.nx, it.ny, it.landRegId, it.taRegId, it.taMatch) },
            ),
        )

    @PutMapping("/internal/weather/short")
    fun short(@Valid @RequestBody request: WeatherShortRequest): ApiResponse<SyncWeatherUseCase.Applied> =
        ApiResponse.success(sync.applyShort(request.items.map { SyncWeatherUseCase.ShortItem(it.nx, it.ny, it.baseDate, it.baseTime, it.itemsRaw) }))

    @PutMapping("/internal/weather/mid")
    fun mid(@Valid @RequestBody request: WeatherMidRequest): ApiResponse<SyncWeatherUseCase.Applied> =
        ApiResponse.success(sync.applyMid(request.items.map { SyncWeatherUseCase.MidItem(it.regId, it.kind, it.tmFc, it.itemRaw) }))

    companion object {
        private val KST: ZoneId = ZoneId.of("Asia/Seoul")

        /** 단기는 격자 하나가 약 1,000행(JSON 약 110KB)이라 수집기가 10격자씩 보낸다(`weather.PUSH_GRIDS`). */
        const val MAX_SHORT = 50
        const val MAX_MID = 500
        const val MAX_AREAS = 1_000
    }
}

data class WeatherAreasRequest(
    @field:Size(max = WeatherController.MAX_AREAS) @field:Valid val midRegions: List<MidRegion>,
    @field:NotEmpty @field:Size(max = WeatherController.MAX_AREAS) @field:Valid val areas: List<Area>,
) {
    data class MidRegion(
        @field:Pattern(regexp = "\\w{8}") val regId: String,
        @field:Pattern(regexp = "LAND|TA") val kind: String,
        @field:NotBlank @field:Size(max = 40) val name: String,
    )

    data class Area(
        @field:Pattern(regexp = "\\d{5}") val sigunguCode: String,
        val nx: Int,
        val ny: Int,
        @field:Pattern(regexp = "\\w{8}") val landRegId: String? = null,
        @field:Pattern(regexp = "\\w{8}") val taRegId: String? = null,
        @field:Size(max = 16) val taMatch: String? = null,
    )
}

data class WeatherShortRequest(
    @field:NotEmpty @field:Size(max = WeatherController.MAX_SHORT) @field:Valid val items: List<Item>,
) {
    data class Item(
        val nx: Int,
        val ny: Int,
        @field:Pattern(regexp = "\\d{8}") val baseDate: String,
        @field:Pattern(regexp = "\\d{4}") val baseTime: String,
        @field:NotBlank val itemsRaw: String,
    )
}

data class WeatherMidRequest(
    @field:NotEmpty @field:Size(max = WeatherController.MAX_MID) @field:Valid val items: List<Item>,
) {
    data class Item(
        @field:Pattern(regexp = "\\w{8}") val regId: String,
        @field:Pattern(regexp = "LAND|TA") val kind: String,
        @field:Pattern(regexp = "\\d{12}") val tmFc: String,
        @field:NotBlank val itemRaw: String,
    )
}
