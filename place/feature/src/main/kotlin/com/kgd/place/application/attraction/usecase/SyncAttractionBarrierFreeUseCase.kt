package com.kgd.place.application.attraction.usecase

import java.time.LocalDateTime

/**
 * 무장애 여행 정보 적재 — place-ingest `--job=attraction-attrs` 가 쓰는 경로. 서버는 파생하지 않고 앞뒤만 검사해 저장한다.
 * 목록과 상세는 따로 들어온다: 목록은 하루 한 콜에 전량, 상세는 하루 예산만큼.
 */
interface SyncAttractionBarrierFreeUseCase {
    /** 목록 행 upsert — 국문 관광지에 붙는 것만. 이미 받은 상세는 건드리지 않는다. */
    fun applyList(items: List<ListItem>): ListApplied

    /** 상세 원문 + 파생 플래그. 목록으로 붙지 않은 contentId 는 건너뛴다. */
    fun applyDetails(items: List<DetailItem>): Int

    /** 상세 대상 선택용 — 행마다 목록 수정 시각과 마지막 상세 수집 시각. */
    fun states(): List<State>

    data class ListItem(val contentId: String, val listRaw: String, val listModifiedAt: LocalDateTime?)

    data class DetailItem(
        val contentId: String,
        val detailRaw: String?,
        val flags: List<String>,
        val flagsRuleVer: Int,
        val detailSyncedAt: LocalDateTime,
    )

    /** [unmatchedSample] 은 못 붙은 contentId 앞 20개 — 로그로 원인을 볼 수 있게. */
    data class ListApplied(val matched: Int, val unmatched: Int, val unmatchedSample: List<String>)

    data class State(val contentId: String, val listModifiedAt: LocalDateTime?, val detailSyncedAt: LocalDateTime?)
}
