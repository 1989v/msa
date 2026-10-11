package com.kgd.place.domain.attraction.model

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import java.time.LocalDate

/** 가까운 지점의 종류와 그 직선거리 상한(m). */
enum class TransitKind(val maxDistanceM: Int) {
    RAIL(AttractionAccess.RAIL_MAX_DISTANCE_M),
    BUS(AttractionAccess.BUS_MAX_DISTANCE_M),
}

/**
 * 관광지 가는 법 한 줄 — 가까운 도시철도역 또는 버스정류장 하나와 하버사인 직선거리.
 *
 * 계산은 수집기(place-ingest `transit_stops.nearest_stops`)가 끝내고 온다. 원천 행을 대리 키로 잇지 않고 원천 자연 키([sourceKey])와
 * 그 시점의 이름·영문 이름·노선 사본을 둔다 — 원천 회차가 바뀌어도 읽는 값이 그대로다.
 * 도보 시간은 없다 — 길 경로 자료가 없어 직선거리로 시간을 내면 근거가 없다.
 *
 * 반경·순위 상한의 원본은 수집기 상수(`RAIL_RADIUS_M`·`BUS_RADIUS_M`·`PER_KIND`)이고, 여기 값과 같은지 수집기 테스트가 이 파일을 읽어 대조한다.
 * 어긋난 값은 400 으로 막는다.
 */
data class AttractionAccess(
    val attractionId: Long,
    val kind: TransitKind,
    val rank: Int,
    val sourceKey: String,
    val name: String,
    val nameEn: String?,
    val lines: String?,
    val distanceM: Int,
    val baseDate: LocalDate?,
) {
    init {
        if (rank !in 1..MAX_RANK) invalid("순위는 1..$MAX_RANK 이다: $attractionId $kind $rank")
        if (distanceM !in 0..kind.maxDistanceM) invalid("$kind 직선거리는 0..${kind.maxDistanceM}m 이다: $attractionId $distanceM")
        if (sourceKey.isBlank() || name.isBlank()) invalid("원천 키·이름이 비었다: $attractionId $kind")
    }

    companion object {
        const val RAIL_MAX_DISTANCE_M = 2_000
        const val BUS_MAX_DISTANCE_M = 500
        const val MAX_RANK = 2

        private fun invalid(message: String): Nothing = throw BusinessException(ErrorCode.INVALID_INPUT, message)
    }
}
