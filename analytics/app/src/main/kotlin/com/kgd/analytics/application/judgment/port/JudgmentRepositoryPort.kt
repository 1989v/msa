package com.kgd.analytics.application.judgment.port

import java.time.Instant

/** 검색 판정(judgment) 원장 — ClickHouse `analytics.search_judgments` (ADR-0050 Phase 4). */
interface JudgmentRepositoryPort {
    fun upsertManual(query: String, productId: String, relevance: Int, weight: Double)
    fun list(queryFilter: String?, limit: Int, offset: Int): List<JudgmentRecord>
    fun distinctQueries(prefix: String?, limit: Int): List<String>
}

data class JudgmentRecord(
    val query: String,
    val productId: String,
    val relevance: Int,
    val source: String,
    val weight: Double,
    val createdAt: Instant,
)
