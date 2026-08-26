package com.kgd.analytics.application.judgment.usecase

import com.kgd.analytics.application.judgment.port.JudgmentRecord

/** 검색 판정 수동 라벨링 (ADR-0050 Phase 4). 권한(ADMIN) 확인은 컨트롤러 책임. */
interface ManageSearchJudgmentsUseCase {
    fun upsert(command: Command)
    fun list(queryFilter: String?, limit: Int, offset: Int): List<JudgmentRecord>
    fun distinctQueries(prefix: String?, limit: Int): List<String>

    data class Command(
        val query: String,
        val productId: String,
        val relevance: Int,
        val weight: Double?,
    )
}
