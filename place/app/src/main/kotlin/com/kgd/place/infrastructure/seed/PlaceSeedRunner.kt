package com.kgd.place.infrastructure.seed

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.place.application.region.port.RegionRepositoryPort
import com.kgd.place.application.region.usecase.CreateRegionUseCase
import com.kgd.place.domain.region.model.RegionLevel
import com.kgd.place.infrastructure.config.PlaceSeedProperties
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Component
import java.nio.file.Files
import java.nio.file.Path

/**
 * ADR-0056 Part 2 — 오픈데이터 지리 시드 적재기 (place.seed.enabled=true 전용).
 *
 * regions JSONL 을 읽어 레벨 순서(CONTINENT→COUNTRY→REGION→CITY)로 적재하며,
 * geonames_id → 생성된 id 맵으로 parentGeonamesId 를 parentId 로 해소한다.
 * 테이블이 이미 채워져 있으면 멱등하게 skip.
 */
@Component
@ConditionalOnProperty(prefix = "place.seed", name = ["enabled"], havingValue = "true")
class PlaceSeedRunner(
    private val createRegionUseCase: CreateRegionUseCase,
    private val regionRepository: RegionRepositoryPort,
    private val objectMapper: ObjectMapper,
    private val props: PlaceSeedProperties,
) : ApplicationRunner {

    private val log = KotlinLogging.logger {}

    override fun run(args: ApplicationArguments) {
        seedRegions()
    }

    private fun seedRegions() {
        if (regionRepository.count() > 0L) {
            log.info { "regions 이미 적재됨 — 시드 skip" }
            return
        }
        val path = Path.of(props.regionsPath)
        if (!Files.exists(path)) {
            log.warn { "regions 시드 파일 없음: ${props.regionsPath} — skip" }
            return
        }

        val records = readRecords(path)
        val idByGeonames = HashMap<Long, Long>()
        var total = 0

        for (level in RegionLevel.values()) {
            val ofLevel = records.filter { it.level == level }
            if (ofLevel.isEmpty()) continue

            val commands = ofLevel.map { rec ->
                rec to CreateRegionUseCase.Command(
                    level = rec.level,
                    name = rec.name,
                    parentId = rec.parentGeonamesId?.let { idByGeonames[it] },
                    nameKo = rec.nameKo,
                    countryCode = rec.countryCode,
                    admin1Code = rec.admin1Code,
                    admin2Code = rec.admin2Code,
                    geonamesId = rec.geonamesId,
                    latitude = rec.latitude,
                    longitude = rec.longitude,
                    population = rec.population,
                )
            }
            val saved = createRegionUseCase.executeBulk(commands.map { it.second })
            commands.map { it.first }.zip(saved).forEach { (rec, res) ->
                rec.geonamesId?.let { idByGeonames[it] = res.id }
            }
            total += saved.size
            log.info { "regions 시드: $level ${saved.size}건" }
        }
        log.info { "regions 시드 완료: 총 ${total}건 (source=${props.regionsPath})" }
    }

    private fun readRecords(path: Path): List<RegionSeedRecord> =
        Files.newBufferedReader(path).useLines { lines ->
            lines.map { it.trim() }
                .filter { it.isNotEmpty() && !it.startsWith("#") }
                .map { objectMapper.readValue(it, RegionSeedRecord::class.java) }
                .toList()
        }

    data class RegionSeedRecord(
        val level: RegionLevel,
        val name: String,
        val nameKo: String? = null,
        val countryCode: String? = null,
        val admin1Code: String? = null,
        val admin2Code: String? = null,
        val geonamesId: Long? = null,
        val parentGeonamesId: Long? = null,
        val latitude: Double? = null,
        val longitude: Double? = null,
        val population: Long? = null,
    )
}
