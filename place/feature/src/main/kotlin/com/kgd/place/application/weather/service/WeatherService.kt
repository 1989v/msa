package com.kgd.place.application.weather.service

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.place.application.weather.usecase.WeatherUseCase
import com.kgd.place.domain.weather.model.WeatherOutlook
import com.kgd.place.domain.weather.model.WeatherSource
import org.springframework.stereotype.Service
import java.time.LocalDate
import java.time.LocalDateTime

/**
 * 시군구 날씨 조회. 캐시 값([WeatherOutlookLoader])을 읽는 시각으로 거른다 — 지난 날짜와 신선도 기준을 넘긴 발표본의 날은 뺀다.
 * 거르기를 캐시 앞에서 하면 캐시가 사는 13시간 동안 기준을 넘긴 값이 그대로 나간다.
 */
@Service
class WeatherService(
    private val loader: WeatherOutlookLoader,
) : WeatherUseCase {

    override fun outlook(sigunguCode: String, now: LocalDateTime): WeatherUseCase.Outlook {
        if (!SIGUNGU.matches(sigunguCode)) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "시군구 코드는 5자리 숫자다: $sigunguCode")
        }
        val cached = loader.load(sigunguCode)
        val shortBaseAt = cached.shortBaseAt?.let(LocalDateTime::parse)
        val midTmFc = cached.midTmFc?.let(LocalDateTime::parse)
        val days = cached.days.filter {
            WeatherOutlook.visible(LocalDate.parse(it.date), WeatherSource.valueOf(it.source), shortBaseAt, midTmFc, now)
        }
        return cached.copy(
            shortBaseAt = cached.shortBaseAt.takeIf { days.any { it.source == WeatherSource.SHORT.name } },
            midTmFc = cached.midTmFc.takeIf { days.any { it.source == WeatherSource.MID.name } },
            days = days,
        )
    }

    private companion object {
        val SIGUNGU = Regex("\\d{5}")
    }
}
