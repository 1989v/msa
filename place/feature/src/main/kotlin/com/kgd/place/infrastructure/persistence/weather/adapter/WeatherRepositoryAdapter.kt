package com.kgd.place.infrastructure.persistence.weather.adapter

import com.kgd.place.application.weather.port.WeatherRepositoryPort
import com.kgd.place.domain.weather.model.MidForecast
import com.kgd.place.domain.weather.model.MidKind
import com.kgd.place.domain.weather.model.MidRegion
import com.kgd.place.domain.weather.model.ShortForecast
import com.kgd.place.domain.weather.model.ShortForecastItem
import com.kgd.place.domain.weather.model.WeatherArea
import com.kgd.place.infrastructure.persistence.weather.entity.WeatherGridId
import com.kgd.place.infrastructure.persistence.weather.entity.WeatherMidForecastId
import com.kgd.place.infrastructure.persistence.weather.repository.WeatherMidForecastJpaRepository
import com.kgd.place.infrastructure.persistence.weather.repository.WeatherMidRegionJpaRepository
import com.kgd.place.infrastructure.persistence.weather.repository.WeatherShortForecastJpaRepository
import com.kgd.place.infrastructure.persistence.weather.repository.WeatherSigunguGridJpaRepository
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.json.JsonMapper
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

@Component
class WeatherRepositoryAdapter(
    private val grids: WeatherSigunguGridJpaRepository,
    private val shorts: WeatherShortForecastJpaRepository,
    private val regions: WeatherMidRegionJpaRepository,
    private val mids: WeatherMidForecastJpaRepository,
) : WeatherRepositoryPort {

    @Transactional
    override fun upsertAreas(areas: List<WeatherArea>, syncedAt: LocalDateTime): Int {
        areas.forEach { grids.upsert(it.sigunguCode, it.nx, it.ny, it.landRegId, it.taRegId, it.taMatch, syncedAt) }
        return areas.size
    }

    @Transactional
    override fun upsertMidRegions(regions: List<MidRegion>): Int {
        regions.forEach { this.regions.upsert(it.regId, it.kind.name, it.name) }
        return regions.size
    }

    @Transactional
    override fun upsertShort(rows: List<WeatherRepositoryPort.ShortRaw>, fetchedAt: LocalDateTime): Int {
        rows.forEach { shorts.upsert(it.nx, it.ny, it.baseAt, it.itemsRaw, fetchedAt) }
        return rows.size
    }

    @Transactional
    override fun upsertMid(rows: List<WeatherRepositoryPort.MidRaw>, fetchedAt: LocalDateTime): Int {
        rows.forEach { mids.upsert(it.regId, it.kind.name, it.tmFc, it.itemRaw, fetchedAt) }
        return rows.size
    }

    override fun findArea(sigunguCode: String): WeatherArea? =
        grids.findById(sigunguCode).orElse(null)?.let {
            WeatherArea(it.sigunguCode, it.nx.toInt(), it.ny.toInt(), it.landRegId, it.taRegId, it.taMatch)
        }

    override fun findShort(nx: Int, ny: Int): ShortForecast? =
        shorts.findById(WeatherGridId(nx.toShort(), ny.toShort())).orElse(null)?.let {
            ShortForecast(nx, ny, it.baseAt, shortItems(it.itemsRaw))
        }

    override fun findMid(regId: String, kind: MidKind): MidForecast? =
        mids.findById(WeatherMidForecastId(regId, kind.name)).orElse(null)?.let {
            MidForecast(regId, kind, it.tmFc, midFields(it.itemRaw))
        }

    override fun findSigunguByGrids(grids: Collection<Pair<Int, Int>>): List<String> =
        grids.flatMap { (nx, ny) -> this.grids.findCodesByGrid(nx, ny) }

    override fun findSigunguByMidRegions(regIds: Collection<String>): List<String> =
        if (regIds.isEmpty()) emptyList() else grids.findCodesByMidRegions(regIds)

    companion object {
        // Spring 빈을 주입받지 않는다 — 원문 배열·객체를 맵으로 펴기만 하므로 설정이 필요 없다
        private val json = JsonMapper.builder().build()
        private val YMD: DateTimeFormatter = DateTimeFormatter.BASIC_ISO_DATE

        /** getVilageFcst item 배열 → 행. 범주·날짜·시각·값이 없는 행은 건너뛴다(원문은 표에 그대로 남는다). */
        fun shortItems(raw: String): List<ShortForecastItem> =
            json.readValue(raw, List::class.java).mapNotNull { row ->
                val m = row as? Map<*, *> ?: return@mapNotNull null
                val category = m["category"]?.toString() ?: return@mapNotNull null
                val date = m["fcstDate"]?.toString()?.let { runCatching { LocalDate.parse(it, YMD) }.getOrNull() } ?: return@mapNotNull null
                val time = m["fcstTime"]?.toString()?.toIntOrNull() ?: return@mapNotNull null
                ShortForecastItem(category, date, time, m["fcstValue"]?.toString() ?: return@mapNotNull null)
            }

        /** 중기 항목 → 키·값 문자열. 원천은 수(rnSt4Am: 20)와 글(wf4Am: 「구름많음」)을 섞어 준다. */
        fun midFields(raw: String): Map<String, String?> =
            json.readValue(raw, Map::class.java).entries.associate { (k, v) -> k.toString() to v?.toString() }
    }
}
