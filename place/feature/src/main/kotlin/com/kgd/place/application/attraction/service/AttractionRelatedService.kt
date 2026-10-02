package com.kgd.place.application.attraction.service

import com.kgd.place.application.attraction.port.AttractionRelatedRepositoryPort
import com.kgd.place.application.attraction.usecase.SyncAttractionRelatedUseCase
import com.kgd.place.domain.attraction.model.AttractionRelated
import com.kgd.place.domain.attraction.model.NameMatch
import com.kgd.place.domain.attraction.model.RelatedTarget
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

private val log = KotlinLogging.logger {}

/** 연관 관광지 저장. 관광지 행(attractions)에는 쓰지 않는다 — bulk upsert(전체 동기화) 경로와 갈라 두어야 지워지지 않는다. */
@Service
class AttractionRelatedService(
    private val repository: AttractionRelatedRepositoryPort,
) : SyncAttractionRelatedUseCase {

    @Transactional
    override fun replaceSigungu(
        signguCd: String,
        baseYm: String,
        items: List<SyncAttractionRelatedUseCase.Item>,
    ): SyncAttractionRelatedUseCase.Applied {
        // 빈 목록으로 그 시군구를 지우는 길은 열지 않는다 — 원천이 잠깐 0건을 준 날 지난달 목록이 통째로 사라진다
        require(items.isNotEmpty()) { "items 는 비어있을 수 없습니다" }
        val codes = items.map { it.tAtsCd.trim() }
        require(codes.toSet().size == codes.size) { "한 시군구에 같은 출발 관광지가 두 번 왔습니다: $signguCd" }
        val rows = items.map { item ->
            AttractionRelated(
                tAtsCd = item.tAtsCd.trim(), tAtsNm = item.tAtsNm.trim(), signguCd = signguCd, baseYm = baseYm,
                relatedRaw = item.relatedRaw, attractionId = item.attractionId, matchMethod = method(item.matchMethod),
                targets = item.targets.map {
                    RelatedTarget(it.rank, it.name, it.lcls, it.mcls, it.scls, it.signguCd, it.attractionId, method(it.matchMethod))
                },
            )
        }
        // 늦게 온 옛 달이 새 달을 덮지 않게 — 수동 재수집(--base-ym)이 지난달을 다시 보내도 이번 달 목록이 남는다
        repository.latestBaseYmBySigungu()[signguCd]?.let { stored ->
            require(baseYm >= stored) { "$signguCd 는 이미 $stored 을 갖고 있습니다 — 더 옛 달($baseYm)로 바꾸지 않습니다" }
        }
        val removed = repository.replaceSigungu(signguCd, rows, LocalDateTime.now())
        val linked = rows.count { it.attractionId != null }
        log.info { "연관 관광지($signguCd $baseYm): 출발 ${rows.size} · 관광지에 이음 $linked · 이전 행 $removed" }
        return SyncAttractionRelatedUseCase.Applied(rows.size, linked, removed)
    }

    @Transactional(readOnly = true)
    override fun state(): Map<String, String> = repository.latestBaseYmBySigungu()

    private fun method(name: String): NameMatch =
        runCatching { NameMatch.valueOf(name) }.getOrElse { _ -> throw IllegalArgumentException("모르는 매칭 방법입니다: $name") }
}
