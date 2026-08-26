package com.kgd.search.application.ranking.usecase

import com.kgd.search.domain.bandit.model.ClickEvent
import com.kgd.search.domain.bandit.model.ImpressionEvent

/** 검색 결과 노출·클릭 보고 — 밴딧 posterior 갱신의 입력 (ADR-0050). */
interface RecordSearchInteractionUseCase {
    fun recordImpressions(events: List<ImpressionEvent>)
    fun recordClick(event: ClickEvent)
}
