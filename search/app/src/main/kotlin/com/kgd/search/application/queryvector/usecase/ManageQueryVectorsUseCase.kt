package com.kgd.search.application.queryvector.usecase

import com.kgd.search.domain.queryvector.model.QueryVector

/**
 * 사전 적재·미적중 회수 — `tools/embed` 가 쓰는 경로 (ADR-0090).
 *
 * **정규화는 서버가 한다.** 도구는 원문 `query` 를 보낸다 — 규칙이 두 곳에 있으면 `_id` 가 어긋나
 * 사전이 통째로 미적중이 된다.
 */
interface ManageQueryVectorsUseCase {
    fun upsert(modelRef: String, items: List<Item>): Applied
    fun misses(modelRef: String, limit: Int): List<Miss>
    fun clearMisses(modelRef: String, normalized: List<String>): Int
    fun status(modelRef: String): Status

    data class Item(val query: String, val vector: List<Float>, val source: QueryVector.Source)

    /** 정규화 결과가 빈 질의(부호만 친 것)는 넣지 않고 [skippedEmpty] 로만 센다. */
    data class Applied(val upserted: Int, val skippedEmpty: Int)

    data class Miss(val normalized: String, val count: Long)

    data class Status(val modelRef: String, val entries: Long, val pendingMisses: Long)
}
