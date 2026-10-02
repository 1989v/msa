package com.kgd.place.infrastructure.persistence.attraction.adapter

import com.kgd.place.application.attraction.port.AttractionCongestionRepositoryPort
import com.kgd.place.domain.attraction.model.AttractionCongestion
import com.kgd.place.domain.attraction.model.CongestionDay
import com.kgd.place.domain.attraction.model.CongestionForecast
import com.kgd.place.domain.attraction.model.CongestionMatch
import com.kgd.place.infrastructure.persistence.attraction.entity.AttractionCongestionJpaEntity
import com.kgd.place.infrastructure.persistence.attraction.repository.AttractionCongestionJpaRepository
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Component
import tools.jackson.databind.json.JsonMapper
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

private val log = KotlinLogging.logger {}

@Component
class AttractionCongestionRepositoryAdapter(
    private val repository: AttractionCongestionJpaRepository,
) : AttractionCongestionRepositoryPort {

    override fun replaceSigungu(signguCd: String, rows: List<AttractionCongestion>, fetchedAt: LocalDateTime): Int {
        val removed = repository.deleteBySignguCd(signguCd)
        repository.saveAll(
            rows.map {
                AttractionCongestionJpaEntity(
                    signguCd = it.signguCd, tAtsNm = it.tAtsNm, areaCd = it.areaCd, areaNm = it.areaNm, signguNm = it.signguNm,
                    ratesRaw = it.ratesRaw, firstYmd = it.firstYmd, lastYmd = it.lastYmd,
                    attractionId = it.attractionId, matchMethod = it.matchMethod.name, fetchedAt = fetchedAt,
                )
            },
        )
        return removed
    }

    override fun findForecasts(attractionIds: Collection<Long>, methods: Set<CongestionMatch>): List<CongestionForecast> {
        if (attractionIds.isEmpty() || methods.isEmpty()) return emptyList()
        return attractionIds.chunked(IN_CHUNK)
            .flatMap { repository.findByAttractionIdInAndMatchMethodIn(it, methods.map { m -> m.name }) }
            .mapNotNull { row ->
                val days = days(row.ratesRaw)
                if (days.isEmpty()) {
                    log.warn { "집중률 원문을 못 읽었다: ${row.signguCd} ${row.tAtsNm}" }
                    null
                } else {
                    CongestionForecast(row.attractionId!!, CongestionMatch.valueOf(row.matchMethod!!), row.lastYmd, days)
                }
            }
    }

    /** 원천 행 배열 → (예측일, 집중률). 날짜·값을 못 읽는 행은 건너뛴다 — 0 으로 채우지 않는다. */
    private fun days(raw: String): List<CongestionDay> {
        val node = runCatching { json.readTree(raw) }.getOrNull()?.takeIf { it.isArray } ?: return emptyList()
        return node.mapNotNull { row ->
            val date = runCatching { LocalDate.parse(row.path("baseYmd").asString(), YMD) }.getOrNull()
            val rate = row.path("cnctrRate").asString().toDoubleOrNull()?.takeIf { it.isFinite() }
            if (date == null || rate == null) null else CongestionDay(date, rate)
        }.sortedBy { it.date }
    }

    private companion object {
        val json: JsonMapper = JsonMapper.builder().build()
        val YMD: DateTimeFormatter = DateTimeFormatter.BASIC_ISO_DATE

        /** IN 절 하나에 싣는 값 수 — 재색인 묶음(500)이 한 번에 들어간다. */
        const val IN_CHUNK = 1_000
    }
}
