package com.kgd.place.application.weather.service

import com.kgd.place.application.region.service.RegionCaches
import com.kgd.place.application.weather.port.WeatherRepositoryPort
import com.kgd.place.application.weather.usecase.WeatherUseCase
import com.kgd.place.domain.weather.model.DailyWeather
import com.kgd.place.domain.weather.model.HalfDay
import com.kgd.place.domain.weather.model.MidKind
import com.kgd.place.domain.weather.model.WeatherOutlook
import org.springframework.cache.annotation.CachePut
import org.springframework.cache.annotation.Cacheable
import org.springframework.stereotype.Service

/**
 * 시군구 날씨의 캐시 값. 화면 요청은 레디스에서 나간다 — 적재가 받은 격자·구역을 쓰는 시군구의 값을 다시 만들어 덮으므로
 * (write-through) 적재 뒤 첫 요청도 MySQL 을 치지 않는다. 캐시를 놓친 요청만 PK 행 넷(매핑 · 단기 · 육상 · 기온)을 읽는다.
 *
 * 캐시에는 신선도로 거르기 **전** 값을 둔다 — 거르는 기준이 읽는 시각이라서다([WeatherService]).
 */
@Service
class WeatherOutlookLoader(
    private val repository: WeatherRepositoryPort,
) {

    @Cacheable(RegionCaches.WEATHER, key = "#sigunguCode")
    fun load(sigunguCode: String): WeatherUseCase.Outlook = build(sigunguCode)

    /** 적재 경로가 부른다 — 계산한 값으로 캐시 키를 덮는다. 다른 빈([WeatherSyncService])에서 불러야 프록시를 탄다. */
    @CachePut(RegionCaches.WEATHER, key = "#sigunguCode")
    fun refresh(sigunguCode: String): WeatherUseCase.Outlook = build(sigunguCode)

    private fun build(sigunguCode: String): WeatherUseCase.Outlook {
        val area = repository.findArea(sigunguCode)
            ?: return WeatherUseCase.Outlook(sigunguCode, null, null, emptyList())
        val short = repository.findShort(area.nx, area.ny)
        val land = area.landRegId?.let { repository.findMid(it, MidKind.LAND) }
        val ta = area.taRegId?.let { repository.findMid(it, MidKind.TA) }
        return WeatherUseCase.Outlook(
            sigunguCode = sigunguCode,
            shortBaseAt = short?.baseAt?.toString(),
            midTmFc = WeatherOutlook.midIssuedAt(land, ta)?.toString(),
            days = WeatherOutlook.days(short, land, ta).map { it.toView() },
        )
    }

    private fun DailyWeather.toView() = WeatherUseCase.Day(
        date = date.toString(), source = source.name, min = min, max = max,
        am = am?.toView(), pm = pm?.toView(), allDay = allDay?.toView(),
    )

    private fun HalfDay.toView() = WeatherUseCase.Half(sky, pop)
}
