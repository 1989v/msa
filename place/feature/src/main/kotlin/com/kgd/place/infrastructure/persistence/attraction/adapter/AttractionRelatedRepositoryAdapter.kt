package com.kgd.place.infrastructure.persistence.attraction.adapter

import com.kgd.place.application.attraction.port.AttractionRelatedRepositoryPort
import com.kgd.place.domain.attraction.model.AttractionRelated
import com.kgd.place.domain.attraction.model.NameMatch
import com.kgd.place.domain.attraction.model.RelatedTarget
import com.kgd.place.infrastructure.persistence.attraction.entity.AttractionRelatedJpaEntity
import com.kgd.place.infrastructure.persistence.attraction.repository.AttractionRelatedJpaRepository
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Component
import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import java.time.LocalDateTime

private val log = KotlinLogging.logger {}

@Component
class AttractionRelatedRepositoryAdapter(
    private val repository: AttractionRelatedJpaRepository,
) : AttractionRelatedRepositoryPort {

    override fun replaceSigungu(signguCd: String, rows: List<AttractionRelated>, fetchedAt: LocalDateTime): Int {
        val removed = repository.deleteBySignguCd(signguCd)
        repository.saveAll(
            rows.map {
                AttractionRelatedJpaEntity(
                    tAtsCd = it.tAtsCd, tAtsNm = it.tAtsNm, signguCd = it.signguCd, baseYm = it.baseYm, relatedRaw = it.relatedRaw,
                    attractionId = it.attractionId, matchMethod = it.matchMethod.name, targets = writeTargets(it.targets),
                    fetchedAt = fetchedAt,
                )
            },
        )
        return removed
    }

    override fun latestBaseYmBySigungu(): Map<String, String> =
        repository.findLatestBaseYmBySigungu().associate { (signgu, baseYm) -> signgu as String to baseYm as String }

    override fun findLinked(attractionIds: Collection<Long>, methods: Set<NameMatch>): List<AttractionRelated> {
        if (attractionIds.isEmpty() || methods.isEmpty()) return emptyList()
        return attractionIds.chunked(IN_CHUNK)
            .flatMap { repository.findByAttractionIdInAndMatchMethodIn(it, methods.map { m -> m.name }) }
            .mapNotNull { row ->
                val targets = readTargets(row.targets)
                if (targets == null) {
                    log.warn { "연관 대상 파생 값을 못 읽었다: ${row.signguCd} ${row.tAtsNm}" }
                    null
                } else {
                    AttractionRelated(
                        row.tAtsCd, row.tAtsNm, row.signguCd, row.baseYm, row.relatedRaw,
                        row.attractionId, NameMatch.valueOf(row.matchMethod!!), targets,
                    )
                }
            }
    }

    private fun writeTargets(targets: List<RelatedTarget>): String =
        json.writeValueAsString(
            targets.map {
                linkedMapOf(
                    "rank" to it.rank, "name" to it.name, "lcls" to it.lcls, "mcls" to it.mcls, "scls" to it.scls,
                    "signguCd" to it.signguCd, "attractionId" to it.attractionId, "matchMethod" to it.matchMethod.name,
                )
            },
        )

    /** 파생 배열 → 대상. 배열이 아니거나 항목 하나라도 못 읽으면 null — 일부만 읽어 순위가 비는 목록을 내지 않는다. */
    private fun readTargets(raw: String?): List<RelatedTarget>? {
        val node = raw?.let { runCatching { json.readTree(it) }.getOrNull() }?.takeIf { it.isArray } ?: return null
        return runCatching {
            node.toList().map { t ->
                RelatedTarget(
                    rank = t.path("rank").asInt(),
                    name = t.path("name").asString(),
                    lcls = text(t, "lcls"), mcls = text(t, "mcls"), scls = text(t, "scls"), signguCd = text(t, "signguCd"),
                    attractionId = t.path("attractionId").takeIf { it.isNumber }?.asLong(),
                    matchMethod = NameMatch.valueOf(t.path("matchMethod").asString()),
                )
            }
        }.getOrNull()
    }

    private fun text(node: JsonNode, field: String): String? = node.path(field).takeIf { it.isString }?.asString()

    private companion object {
        val json: JsonMapper = JsonMapper.builder().build()

        /** IN 절 하나에 싣는 값 수 — 재색인 묶음(500)이 한 번에 들어간다. */
        const val IN_CHUNK = 1_000
    }
}
