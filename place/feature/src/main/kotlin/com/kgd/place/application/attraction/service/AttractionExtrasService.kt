package com.kgd.place.application.attraction.service

import com.kgd.place.application.attraction.port.AttractionCongestionRepositoryPort
import com.kgd.place.application.attraction.port.AttractionExtrasRepositoryPort
import com.kgd.place.application.attraction.port.AttractionRelatedRepositoryPort
import com.kgd.place.application.attraction.usecase.LookupAttractionExtrasUseCase
import com.kgd.place.application.attraction.usecase.SyncAttractionBarrierFreeUseCase
import com.kgd.place.application.attraction.usecase.SyncAttractionWellnessUseCase
import com.kgd.place.domain.attraction.model.AttractionBarrierFree
import com.kgd.place.domain.attraction.model.AttractionRelated
import com.kgd.place.domain.attraction.model.AttractionWellness
import com.kgd.place.domain.attraction.model.CongestionForecast
import com.kgd.place.domain.attraction.model.NameMatch
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

private val log = KotlinLogging.logger {}

/**
 * 관광지에 붙는 2단계 공공데이터(무장애 · 웰니스)의 저장과, 재색인 묶음 조회(무장애 · 웰니스 · 집중률 · 연관 관광지).
 *
 * 관광지 행(attractions)에는 쓰지 않는다 — bulk upsert(전체 동기화) 경로와 갈라 두어야 매일 밤 지워지지 않는다.
 * 원천 contentId 는 그 언어의 관광지 행에 붙을 때만 저장한다. 못 붙은 것은 건수와 표본만 돌려준다.
 */
@Service
class AttractionExtrasService(
    private val repository: AttractionExtrasRepositoryPort,
    private val congestion: AttractionCongestionRepositoryPort,
    private val related: AttractionRelatedRepositoryPort,
) : SyncAttractionBarrierFreeUseCase, SyncAttractionWellnessUseCase, LookupAttractionExtrasUseCase {

    @Transactional
    override fun applyList(items: List<SyncAttractionBarrierFreeUseCase.ListItem>): SyncAttractionBarrierFreeUseCase.ListApplied {
        require(items.isNotEmpty()) { "items 는 비어있을 수 없습니다" }
        // 같은 contentId 가 두 번 오면 뒤엣것이 이긴다 — 원천 목록 한 콜 안에서는 생기지 않는다
        val latest = items.associateBy { it.contentId.trim() }
        val ids = repository.findAttractionIds(BARRIER_FREE_LANG, latest.keys)
        val existing = repository.findBarrierFreeByContentIds(ids.keys).associateBy { it.contentId }
        val rows = ids.map { (contentId, attractionId) ->
            val item = latest.getValue(contentId)
            val stored = existing[contentId]
            AttractionBarrierFree(
                attractionId = attractionId,
                contentId = contentId,
                listRaw = item.listRaw,
                listModifiedAt = item.listModifiedAt,
                // 상세는 목록이 건드리지 않는다
                detailRaw = stored?.detailRaw,
                detailSyncedAt = stored?.detailSyncedAt,
                flags = stored?.flags.orEmpty(),
                flagsRuleVer = stored?.flagsRuleVer,
            )
        }
        repository.saveBarrierFree(rows)
        val unmatched = latest.keys.filterNot { it in ids }.sorted()
        log.info { "무장애 목록: 받음 ${latest.size} · 붙음 ${rows.size} · 못 붙음 ${unmatched.size}" }
        return SyncAttractionBarrierFreeUseCase.ListApplied(rows.size, unmatched.size, unmatched.take(UNMATCHED_SAMPLE))
    }

    @Transactional
    override fun applyDetails(items: List<SyncAttractionBarrierFreeUseCase.DetailItem>): Int {
        require(items.isNotEmpty()) { "items 는 비어있을 수 없습니다" }
        val latest = items.associateBy { it.contentId.trim() }
        val rows = repository.findBarrierFreeByContentIds(latest.keys).map { stored ->
            val item = latest.getValue(stored.contentId)
            stored.copy(
                detailRaw = item.detailRaw,
                detailSyncedAt = item.detailSyncedAt,
                flags = item.flags,
                flagsRuleVer = item.flagsRuleVer,
            )
        }
        val applied = repository.saveBarrierFree(rows)
        log.info { "무장애 상세: 받음 ${latest.size} · 적재 $applied · 목록에 없음 ${latest.size - rows.size}" }
        return applied
    }

    override fun states(): List<SyncAttractionBarrierFreeUseCase.State> =
        repository.findBarrierFreeStates().map { SyncAttractionBarrierFreeUseCase.State(it.contentId, it.listModifiedAt, it.detailSyncedAt) }

    @Transactional
    override fun replace(lang: String, items: List<SyncAttractionWellnessUseCase.Item>): SyncAttractionWellnessUseCase.Applied {
        require(lang in AttractionWellness.LANGS) { "언어는 ko·en 이어야 합니다: $lang" }
        // 빈 목록으로 그 언어의 태그를 통째로 지우는 길은 열지 않는다 — 원천이 잠깐 빈 답을 준 날 전부 사라진다
        require(items.isNotEmpty()) { "items 는 비어있을 수 없습니다" }
        val latest = items.associateBy { it.contentId.trim() }
        val ids = repository.findAttractionIds(lang, latest.keys)
        val rows = ids.map { (contentId, attractionId) ->
            val item = latest.getValue(contentId)
            AttractionWellness(attractionId, contentId, lang, item.themaCd.trim(), item.listRaw)
        }
        val before = repository.replaceWellness(lang, rows, LocalDateTime.now())
        val removed = (before - rows.map { it.attractionId }.toSet()).size
        log.info { "웰니스($lang): 받음 ${latest.size} · 붙음 ${rows.size} · 빠진 태그 $removed" }
        return SyncAttractionWellnessUseCase.Applied(rows.size, latest.size - rows.size, removed)
    }

    override fun lookup(attractionIds: List<Long>): List<LookupAttractionExtrasUseCase.Found> {
        if (attractionIds.isEmpty()) return emptyList()
        val barrierFree = repository.findBarrierFreeByAttractionIds(attractionIds)
            // 목록만 있고 상세를 아직 안 받은 곳은 보여 줄 것이 없다
            .filter { it.detailRaw != null || it.flags.isNotEmpty() }
            .associateBy { it.attractionId }
        val wellness = repository.findWellnessByAttractionIds(attractionIds).associateBy { it.attractionId }
        // 포함 매칭은 정밀도 확인 전이라 싣지 않는다(Q-P2-MATCH) — 저장은 돼 있어 SERVED 만 넓히면 열린다
        val forecasts = CongestionForecast.preferred(congestion.findForecasts(attractionIds, NameMatch.SERVED))
        // 연관도 같은 기준 — 출발이 정확·정규화로 이어진 곳만 묻고, 대상도 그 기준으로 고른다(servedTargets)
        val relatedPlaces = AttractionRelated.preferred(related.findLinked(attractionIds, NameMatch.SERVED))
            .mapValues { (_, row) ->
                row.servedTargets().map { LookupAttractionExtrasUseCase.RelatedPlace(it.rank, it.attractionId!!, it.scls) }
            }
            .filterValues { it.isNotEmpty() }
        return attractionIds.distinct().mapNotNull { id ->
            val bf = barrierFree[id]
            val wl = wellness[id]
            val cg = forecasts[id]
            val rp = relatedPlaces[id]
            if (bf == null && wl == null && cg == null && rp == null) {
                null
            } else {
                LookupAttractionExtrasUseCase.Found(
                    attractionId = id,
                    barrierFree = bf?.let { LookupAttractionExtrasUseCase.BarrierFree(it.flags, it.detailRaw) },
                    wellness = wl?.let { LookupAttractionExtrasUseCase.Wellness(it.themaCd) },
                    congestion = cg?.let { f ->
                        LookupAttractionExtrasUseCase.Congestion(
                            f.matchMethod.name,
                            f.days.map { LookupAttractionExtrasUseCase.Day(it.date.toString(), it.rate) },
                        )
                    },
                    relatedPlaces = rp,
                )
            }
        }
    }

    private companion object {
        /** 무장애 원천은 국문뿐이다(영문 0, 2026-10-02 실측). */
        const val BARRIER_FREE_LANG = "ko"
        const val UNMATCHED_SAMPLE = 20
    }
}
