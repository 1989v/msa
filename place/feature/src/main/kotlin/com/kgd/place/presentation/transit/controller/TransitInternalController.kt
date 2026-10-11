package com.kgd.place.presentation.transit.controller

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.common.response.ApiResponse
import com.kgd.place.application.transit.usecase.SyncTransitSourceUseCase
import com.kgd.place.domain.transit.model.BusCoverage
import com.kgd.place.domain.transit.model.TransitBusStop
import com.kgd.place.domain.transit.model.TransitRailStation
import com.kgd.place.domain.transit.model.TransitSource
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotEmpty
import jakarta.validation.constraints.Size
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDate

/**
 * 역·정류장 원천 적재 — 수집기(place-ingest `--job=transit-stops`)만 부른다. 게이트웨이가 `/internal` 을 라우팅하지 않아 클러스터 밖에서 닿지 않는다.
 * 원천 표는 화면이 읽지 않는다 — 화면은 `attraction_access` 사본을 재색인 문서로 받는다 (ADR-0071 §10).
 */
@RestController
@RequestMapping("/internal/transit")
class TransitInternalController(
    private val transit: SyncTransitSourceUseCase,
) {

    @GetMapping("/{source}/state")
    fun state(@PathVariable source: String): ApiResponse<SyncTransitSourceUseCase.State> =
        ApiResponse.success(transit.state(sourceOf(source)))

    @PutMapping("/rail/runs/{runId}")
    fun putRail(@PathVariable runId: String, @Valid @RequestBody request: RailRowsRequest): ApiResponse<PutResponse> =
        ApiResponse.success(PutResponse(transit.putRail(runId, request.items.map { it.toDomain() })))

    @PutMapping("/bus/runs/{runId}")
    fun putBus(@PathVariable runId: String, @Valid @RequestBody request: BusRowsRequest): ApiResponse<PutResponse> =
        ApiResponse.success(PutResponse(transit.putBus(runId, request.items.map { it.toDomain() })))

    @PostMapping("/{source}/runs/{runId}/activate")
    fun activate(
        @PathVariable source: String,
        @PathVariable runId: String,
        @Valid @RequestBody request: ActivateRequest,
    ): ApiResponse<SyncTransitSourceUseCase.Activated> =
        ApiResponse.success(
            transit.activate(
                sourceOf(source),
                runId,
                request.expectedRows,
                request.coverage?.map { BusCoverage(it.sigunguCode, it.stops, it.covered) },
            ),
        )

    private fun sourceOf(path: String): TransitSource =
        TransitSource.entries.firstOrNull { it.name.equals(path, ignoreCase = true) }
            ?: throw BusinessException(ErrorCode.INVALID_INPUT, "원천은 rail · bus 다: $path")

    companion object {
        /** 수집기 `place_client.BULK_CHUNK` 와 같은 값. */
        const val MAX_ROWS = 2_000

        /** 시군구 수(269)보다 넉넉하게. */
        const val MAX_COVERAGE = 1_000
    }
}

data class PutResponse(val applied: Int)

data class RailRowsRequest(
    @field:NotEmpty(message = "items 는 비어있을 수 없습니다")
    @field:Size(max = TransitInternalController.MAX_ROWS, message = "한 번에 2000건까지")
    val items: List<Item>,
) {
    /** 수집기 `transit_stops.rail_records` 가 만드는 모양 그대로 — 원천 15칸은 원문 문자열(빈 값은 ""), 나머지는 파생. */
    data class Item(
        @field:NotBlank val sourceKey: String,
        val stationNo: String,
        val stationName: String,
        val lineNo: String,
        val lineName: String,
        val stationNameEn: String,
        val stationNameHanja: String,
        val transferType: String,
        val transferLineNo: String,
        val transferLineName: String,
        val latRaw: String,
        val lngRaw: String,
        val operatorName: String,
        val roadAddress: String,
        val phone: String,
        val baseDateRaw: String,
        val latValue: Double?,
        val lngValue: Double?,
        val validCoord: Boolean,
        val baseDate: LocalDate?,
    ) {
        fun toDomain() = TransitRailStation(
            sourceKey, stationNo, stationName, lineNo, lineName, stationNameEn, stationNameHanja, transferType, transferLineNo,
            transferLineName, latRaw, lngRaw, operatorName, roadAddress, phone, baseDateRaw, latValue, lngValue, validCoord, baseDate,
        )
    }
}

data class BusRowsRequest(
    @field:NotEmpty(message = "items 는 비어있을 수 없습니다")
    @field:Size(max = TransitInternalController.MAX_ROWS, message = "한 번에 2000건까지")
    val items: List<Item>,
) {
    /** 수집기 `transit_stops.bus_records` 가 만드는 모양 그대로 — 원천 9칸은 원문 문자열, 나머지는 파생. */
    data class Item(
        @field:NotBlank val sourceKey: String,
        val stopNo: String,
        val stopName: String,
        val latRaw: String,
        val lngRaw: String,
        val collectedDateRaw: String,
        val mobileShortNo: String,
        val cityCode: String,
        val cityName: String,
        val manageCityName: String,
        val latValue: Double?,
        val lngValue: Double?,
        val validCoord: Boolean,
        val collectedDate: LocalDate?,
    ) {
        fun toDomain() = TransitBusStop(
            sourceKey, stopNo, stopName, latRaw, lngRaw, collectedDateRaw, mobileShortNo, cityCode, cityName, manageCityName,
            latValue, lngValue, validCoord, collectedDate,
        )
    }
}

data class ActivateRequest(
    val expectedRows: Int,
    @field:Size(max = TransitInternalController.MAX_COVERAGE)
    val coverage: List<Coverage>? = null,
) {
    data class Coverage(@field:NotBlank val sigunguCode: String, val stops: Int, val covered: Boolean)
}
