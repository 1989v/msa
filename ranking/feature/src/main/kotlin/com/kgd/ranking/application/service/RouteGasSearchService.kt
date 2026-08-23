package com.kgd.ranking.application.service

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.ranking.application.dto.RouteGasCandidate
import com.kgd.ranking.application.dto.RouteGasSearchRequest
import com.kgd.ranking.application.dto.RouteGasSearchResponse
import com.kgd.ranking.infrastructure.persistence.entity.GasStationJpaEntity
import com.kgd.ranking.infrastructure.persistence.repository.GasStationJpaRepository
import com.kgd.ranking.infrastructure.persistence.repository.GasStationPriceJpaRepository
import com.kgd.ranking.infrastructure.routes.Geo
import com.kgd.ranking.infrastructure.routes.GoogleRoutesClient
import com.kgd.ranking.infrastructure.routes.LatLng
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal
import kotlin.math.roundToInt

/**
 * 경로 위에서 조건에 맞는 주유소를 찾는다 (ADR-0081 §7).
 *
 * **오피넷을 실시간으로 부르지 않는다.** 매일 받아둔 전국 스냅샷만 읽는다 — 외부 한도를
 * 사용자 요청 수에 묶으면 인기가 생기는 순간 서비스가 죽는다. 외부 호출은 길찾기 1회뿐이다.
 */
@Service
@Transactional(readOnly = true)
class RouteGasSearchService(
    private val routesClient: GoogleRoutesClient,
    private val stationRepository: GasStationJpaRepository,
    private val priceRepository: GasStationPriceJpaRepository,
) {
    companion object {
        /** 이탈 허용 시간이 아무리 길어도 이 이상 떨어진 곳은 "경로 위"가 아니다 */
        const val MAX_DETOUR_METERS = 15_000.0

        /**
         * "경로에 붙어 있다"로 볼 최소 거리.
         *
         * 도로변 주유소도 경로 중심선에서 10~40m 떨어져 있고 좌표에도 오차가 있다. 하한을
         * 두지 않으면 이탈 허용 0분이 **아무것도 못 찾는 조건**이 된다 — 경로 위 주유소조차
         * 부동소수점 오차로 걸러진다.
         */
        const val ON_ROUTE_METERS = 50.0

        /**
         * 거리 계산용으로 폴리라인을 성기게 만드는 간격.
         *
         * 거리를 꼭짓점이 아니라 **선분**까지 재므로 성글게 만들어도 거리는 정확하다 —
         * 이 값은 정확도가 아니라 계산량만 정한다. 곡선 구간이 직선으로 눌리지 않을 정도면 된다.
         */
        const val PATH_SAMPLE_METERS = 500.0

        const val SOURCE_LABEL = "한국석유공사 오피넷"
    }

    fun search(request: RouteGasSearchRequest): RouteGasSearchResponse {
        validate(request)

        val origin = LatLng(request.origin.latitude, request.origin.longitude)
        val destination = LatLng(request.destination.latitude, request.destination.longitude)
        val route = routesClient.computeRoute(origin, destination)

        val path = Geo.sample(route.path, PATH_SAMPLE_METERS)
        if (path.isEmpty()) {
            return empty(route.encodedPolyline, route.distanceMeters, route.durationSeconds, request.productCode)
        }

        val speed = route.averageSpeedMps
        // "N분까지 돌아갈 수 있다" = 왕복으로 그 시간을 쓸 수 있다는 뜻이라 편도는 절반이다
        val maxDistance = (request.detourLimitMin * 60.0 * speed / 2.0)
            .coerceIn(ON_ROUTE_METERS, MAX_DETOUR_METERS)

        val nearby = stationsWithin(path, maxDistance)
            .mapNotNull { station ->
                val point = Geo.toLatLng(station.latitude, station.longitude) ?: return@mapNotNull null
                val distance = Geo.distanceToPath(point, path)
                if (distance > maxDistance) null else station to distance
            }
            .filter { (station, _) -> station.matches(request) }

        val prices = priceRepository
            .findByStationIdInAndProductCode(nearby.mapNotNull { it.first.id }, request.productCode)
            .associateBy { it.stationId }

        val priced = nearby.mapNotNull { (station, distance) ->
            val price = prices[station.id]?.price ?: return@mapNotNull null
            Triple(station, distance, price)
        }
        if (priced.isEmpty()) {
            return empty(route.encodedPolyline, route.distanceMeters, route.durationSeconds, request.productCode)
        }

        val averagePrice = priced.sumOf { it.third }.toDouble() / priced.size
        val candidates = priced
            .sortedBy { it.third }
            .take(request.limit)
            .map { (station, distance, price) ->
                RouteGasCandidate(
                    opinetId = station.opinetId,
                    name = station.name,
                    brandCode = station.brandCode,
                    brandName = station.brandName,
                    isSelf = station.isSelf,
                    latitude = station.latitude,
                    longitude = station.longitude,
                    roadAddress = station.roadAddress,
                    price = price,
                    detourMinutes = if (speed <= 0) 0 else (distance * 2 / speed / 60).roundToInt(),
                    distanceToRouteMeters = distance.roundToInt(),
                    savingsPerLiter = (averagePrice - price).roundToInt(),
                )
            }

        return RouteGasSearchResponse(
            encodedPolyline = route.encodedPolyline,
            distanceMeters = route.distanceMeters,
            durationMinutes = (route.durationSeconds / 60.0).roundToInt(),
            productCode = request.productCode,
            averagePrice = averagePrice.roundToInt(),
            sourceLabel = SOURCE_LABEL,
            candidates = candidates,
        )
    }

    /**
     * 경로 전체를 감싸는 박스 하나로 후보를 긁어온다.
     *
     * 표본점마다 질의하면 장거리 경로에서 수십~수백 번을 돈다. 전국 주유소가 만 단위라
     * 넉넉한 박스 한 번이 더 싸고, 정확한 거리는 어차피 애플리케이션이 다시 잰다.
     */
    private fun stationsWithin(path: List<LatLng>, maxDistance: Double): List<GasStationJpaEntity> {
        val minLat = path.minOf { it.latitude }
        val maxLat = path.maxOf { it.latitude }
        val minLng = path.minOf { it.longitude }
        val maxLng = path.maxOf { it.longitude }
        val padLat = Geo.latDegrees(maxDistance)
        val padLng = Geo.lngDegrees(maxDistance, (minLat + maxLat) / 2)

        return stationRepository.findWithinBox(
            BigDecimal.valueOf(minLat - padLat),
            BigDecimal.valueOf(maxLat + padLat),
            BigDecimal.valueOf(minLng - padLng),
            BigDecimal.valueOf(maxLng + padLng),
        )
    }

    private fun GasStationJpaEntity.matches(request: RouteGasSearchRequest): Boolean {
        if (request.selfOnly && !isSelf) return false
        if (request.brands.isNotEmpty() && brandCode !in request.brands) return false
        return true
    }

    private fun validate(request: RouteGasSearchRequest) {
        if (request.detourLimitMin < 0 || request.detourLimitMin > 60) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "이탈 허용 시간은 0~60분입니다")
        }
        if (request.limit !in 1..50) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "결과 개수는 1~50개입니다")
        }
        if (request.productCode.isBlank()) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "유종을 지정해야 합니다")
        }
    }

    private fun empty(polyline: String, distance: Int, durationSeconds: Int, productCode: String) =
        RouteGasSearchResponse(
            encodedPolyline = polyline,
            distanceMeters = distance,
            durationMinutes = (durationSeconds / 60.0).roundToInt(),
            productCode = productCode,
            averagePrice = null,
            sourceLabel = SOURCE_LABEL,
            candidates = emptyList(),
        )
}
