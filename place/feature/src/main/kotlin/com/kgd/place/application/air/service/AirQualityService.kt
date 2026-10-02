package com.kgd.place.application.air.service

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.place.application.air.usecase.AirQualityUseCase
import com.kgd.place.domain.air.model.AirQuality
import org.springframework.stereotype.Service
import java.time.LocalDateTime

/**
 * 시군구 대기 조회. 캐시 값([AirQualityLoader])을 읽는 시각으로 거른다 — 측정 3시간이 지난 측정소는 측정을 뺀다(측정소는 남긴다 —
 * 화면이 가장 가까운 측정소를 고른 뒤 그 측정이 없으면 절을 숨긴다. 먼 측정소로 슬쩍 넘어가지 않는다).
 * 거르기를 캐시 앞에서 하면 캐시가 사는 두 시간 동안 기준을 넘긴 값이 그대로 나간다.
 */
@Service
class AirQualityService(
    private val loader: AirQualityLoader,
) : AirQualityUseCase {

    override fun air(sigunguCode: String, now: LocalDateTime): AirQualityUseCase.Air {
        if (!SIGUNGU.matches(sigunguCode)) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "시군구 코드는 5자리 숫자다: $sigunguCode")
        }
        val cached = loader.load(sigunguCode)
        return cached.copy(
            stations = cached.stations.map { station ->
                val fresh = station.measurement?.let { AirQuality.isFresh(LocalDateTime.parse(it.dataTime), now) } ?: false
                if (fresh) station else station.copy(measurement = null)
            },
        )
    }

    private companion object {
        val SIGUNGU = Regex("\\d{5}")
    }
}
