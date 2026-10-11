package com.kgd.place.presentation.attraction.controller

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.common.response.ApiResponse
import com.kgd.place.application.attraction.usecase.SyncAttractionAccessUseCase
import com.kgd.place.domain.attraction.model.AttractionAccess
import com.kgd.place.domain.attraction.model.TransitKind
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotEmpty
import jakarta.validation.constraints.Size
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDate
import java.time.LocalDateTime

/**
 * 관광지 가는 법(가까운 역·정류장) 적재 — 수집기(place-ingest `--job=transit-stops`)만 부른다. 집중률과 같은 이유로 `/internal` 이다.
 * 재색인은 이 값을 `/internal/attractions/extras/lookup` 묶음 조회로 읽는다 — 화면은 이 경로를 부르지 않는다 (ADR-0071 §10).
 * 순위가 1·2 가 아니거나 직선거리가 종류별 상한(역 2,000m · 정류장 500m)을 넘으면 400 이다.
 */
@RestController
@RequestMapping("/internal/attractions/access")
class AttractionAccessInternalController(
    private val access: SyncAttractionAccessUseCase,
) {

    @PutMapping
    fun replace(@Valid @RequestBody request: AccessRequest): ApiResponse<SyncAttractionAccessUseCase.Applied> =
        ApiResponse.success(
            access.replace(
                request.computedAt,
                request.items.map { item ->
                    SyncAttractionAccessUseCase.Item(item.attractionId, item.stops.map { it.toDomain(item.attractionId) })
                },
            ),
        )

    @PostMapping("/prune")
    fun prune(@RequestBody request: PruneRequest): ApiResponse<PruneResponse> =
        ApiResponse.success(PruneResponse(access.prune(request.computedAt)))

    companion object {
        /** 수집기 `place_client.BULK_CHUNK` 와 같은 값 — 관광지 수. */
        const val MAX_ATTRACTIONS = 2_000
    }
}

data class AccessRequest(
    val computedAt: LocalDateTime,
    @field:NotEmpty(message = "items 는 비어있을 수 없습니다")
    @field:Size(max = AttractionAccessInternalController.MAX_ATTRACTIONS, message = "한 번에 2000곳까지")
    val items: List<Item>,
) {
    /** [stops] 가 빈 목록이면 그 관광지의 줄을 지운다(범위 안에 역·정류장이 없다). */
    data class Item(val attractionId: Long, val stops: List<Stop>)

    /** 수집기 `transit_stops.nearest_stops` 가 만드는 모양 그대로. */
    data class Stop(
        @field:NotBlank val kind: String,
        val rank: Int,
        @field:NotBlank val sourceKey: String,
        @field:NotBlank val name: String,
        val nameEn: String? = null,
        val lines: String? = null,
        val distanceM: Int,
        val baseDate: LocalDate? = null,
    ) {
        fun toDomain(attractionId: Long): AttractionAccess {
            val type = TransitKind.entries.firstOrNull { it.name == kind }
                ?: throw BusinessException(ErrorCode.INVALID_INPUT, "종류는 RAIL · BUS 다: $kind")
            return AttractionAccess(attractionId, type, rank, sourceKey, name, nameEn, lines, distanceM, baseDate)
        }
    }
}

data class PruneRequest(val computedAt: LocalDateTime)

data class PruneResponse(val removed: Int)
