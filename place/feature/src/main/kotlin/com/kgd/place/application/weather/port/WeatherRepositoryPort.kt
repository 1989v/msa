package com.kgd.place.application.weather.port

import com.kgd.place.domain.weather.model.MidForecast
import com.kgd.place.domain.weather.model.MidKind
import com.kgd.place.domain.weather.model.MidRegion
import com.kgd.place.domain.weather.model.ShortForecast
import com.kgd.place.domain.weather.model.WeatherArea
import java.time.LocalDateTime

/** 날씨 표 넷(`weather_sigungu_grid` · `weather_short_forecast` · `weather_mid_region` · `weather_mid_forecast`). */
interface WeatherRepositoryPort {

    fun upsertAreas(areas: List<WeatherArea>, syncedAt: LocalDateTime): Int

    fun upsertMidRegions(regions: List<MidRegion>): Int

    /** 격자마다 발표본 하나. 저장된 발표본보다 오래된 것은 덮지 않는다. 반환은 보낸 행 수. */
    fun upsertShort(rows: List<ShortRaw>, fetchedAt: LocalDateTime): Int

    /** (구역, 종류)마다 발표본 하나. 저장된 발표본보다 오래된 것은 덮지 않는다. */
    fun upsertMid(rows: List<MidRaw>, fetchedAt: LocalDateTime): Int

    fun findArea(sigunguCode: String): WeatherArea?

    fun findShort(nx: Int, ny: Int): ShortForecast?

    fun findMid(regId: String, kind: MidKind): MidForecast?

    /** 이 격자들을 쓰는 시군구 — 단기 적재 뒤 캐시를 다시 채울 대상. */
    fun findSigunguByGrids(grids: Collection<Pair<Int, Int>>): List<String>

    /** 이 중기 구역(육상 또는 기온)을 쓰는 시군구. */
    fun findSigunguByMidRegions(regIds: Collection<String>): List<String>

    /** 원천 원문 그대로 — [itemsRaw] 는 getVilageFcst item 배열 JSON. */
    data class ShortRaw(val nx: Int, val ny: Int, val baseAt: LocalDateTime, val itemsRaw: String)

    /** [itemRaw] 는 getMidLandFcst · getMidTa 항목 하나의 JSON. */
    data class MidRaw(val regId: String, val kind: MidKind, val tmFc: LocalDateTime, val itemRaw: String)
}
