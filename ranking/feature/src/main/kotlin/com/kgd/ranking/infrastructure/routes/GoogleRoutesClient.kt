package com.kgd.ranking.infrastructure.routes

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient

private val logger = KotlinLogging.logger {}

/** 한 번의 길찾기 결과 — 경로 좌표열과 총 거리·시간. */
data class RouteResult(
    val path: List<LatLng>,
    val encodedPolyline: String,
    val distanceMeters: Int,
    val durationSeconds: Int,
) {
    /** 이 경로의 평균 속도(m/s). 이탈 시간 근사의 유일한 입력이라 경로마다 달라야 한다. */
    val averageSpeedMps: Double
        get() = if (durationSeconds > 0) distanceMeters.toDouble() / durationSeconds else 11.0
}

/**
 * Google Routes API 어댑터 (ADR-0081 §6).
 *
 * legacy 로 지정된 Directions API 가 아니라 **Routes API** 를 쓴다. 카카오모빌리티 자동차
 * 길찾기는 제휴 파트너 전용이라 후보에서 빠졌다.
 *
 * **무료 구간(Essentials, 월 10,000콜)을 벗어나지 않게 요청을 고정한다.** 두 곳이 SKU 를 올린다:
 *   - `fieldMask` — 필요 없는 필드를 넣는 순간 상위 SKU. Places 를 id-only 로 고정한 것과 같은 이유다
 *   - `routingPreference` — 교통 반영(TRAFFIC_AWARE)은 "고급 기능"이라 Pro SKU(무료분 5,000)로 간다
 *
 * 둘 다 이 파일 안에서만 정해진다 — 늘리려면 여기를 고쳐야 하므로 실수로 넘어가지 않는다.
 *
 * 키가 없으면 이 기능만 비활성이고 리더보드는 정상 동작한다.
 */
@Component
class GoogleRoutesClient(
    @Value("\${ranking.google-routes.api-key:}") private val apiKey: String,
    @Value("\${ranking.google-routes.endpoint:https://routes.googleapis.com/directions/v2:computeRoutes}")
    private val endpoint: String,
    restClientBuilder: RestClient.Builder,
) {
    private val restClient = restClientBuilder.build()

    val enabled: Boolean get() = apiKey.isNotBlank()

    fun computeRoute(origin: LatLng, destination: LatLng): RouteResult {
        if (!enabled) {
            throw BusinessException(
                ErrorCode.EXTERNAL_API_ERROR,
                "경로 탐색이 아직 켜져 있지 않습니다 (길찾기 키 미설정). 리더보드는 그대로 이용할 수 있습니다.",
            )
        }

        val body = mapOf(
            "origin" to waypoint(origin),
            "destination" to waypoint(destination),
            "travelMode" to "DRIVE",
            // **TRAFFIC_AWARE 를 쓰지 않는다.** 실시간 교통 반영은 Google 이 "고급 기능"으로 분류해
            // 상위 SKU(Pro) 로 넘어간다 — 무료분이 월 10,000 에서 5,000 으로 반토막 나고 단가도 오른다.
            // 우리가 이 응답에서 쓰는 것은 폴리라인과 평균 속도뿐이고, 그 평균 속도는 "약 N분"이라는
            // 근사값을 만드는 입력이다. 근사값 하나 때문에 무료 구간을 벗어날 이유가 없다.
            "routingPreference" to "TRAFFIC_UNAWARE",
            "polylineQuality" to "OVERVIEW",
        )

        val response = try {
            restClient.post()
                .uri(endpoint)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Goog-Api-Key", apiKey)
                .header(
                    "X-Goog-FieldMask",
                    "routes.polyline.encodedPolyline,routes.distanceMeters,routes.duration",
                )
                .body(body)
                .retrieve()
                .body(RoutesResponse::class.java)
        } catch (e: Exception) {
            logger.error(e) { "[ROUTES] 길찾기 호출 실패" }
            throw BusinessException(ErrorCode.EXTERNAL_API_ERROR, "길찾기에 실패했습니다")
        }

        val route = response?.routes?.firstOrNull()
            ?: throw BusinessException(ErrorCode.NOT_FOUND, "두 지점을 잇는 자동차 경로를 찾지 못했습니다")

        val encoded = route.polyline?.encodedPolyline.orEmpty()
        return RouteResult(
            path = Polyline.decode(encoded),
            encodedPolyline = encoded,
            distanceMeters = route.distanceMeters ?: 0,
            // Routes API 는 기간을 "1234s" 형태로 준다
            durationSeconds = route.duration?.removeSuffix("s")?.toIntOrNull() ?: 0,
        )
    }

    private fun waypoint(point: LatLng) = mapOf(
        "location" to mapOf(
            "latLng" to mapOf("latitude" to point.latitude, "longitude" to point.longitude),
        ),
    )

    data class RoutesResponse(val routes: List<Route>? = null)
    data class Route(
        val polyline: EncodedPolyline? = null,
        val distanceMeters: Int? = null,
        val duration: String? = null,
    )
    data class EncodedPolyline(val encodedPolyline: String? = null)
}
