package com.kgd.search.domain.queryvector.port

/**
 * 미적중 질의 카운터 (Redis ZSET). **휘발을 허용한다** — 날아가도 잃는 건 하루치 미스뿐이고,
 * 그래서 질의 경로가 이것 때문에 실패하지 않는다(기록은 fire-and-forget).
 */
interface QueryMissPort {
    fun record(modelRef: String, normalized: String)
    fun top(modelRef: String, limit: Int): List<Miss>
    fun remove(modelRef: String, normalized: List<String>): Int
    fun size(modelRef: String): Long

    data class Miss(val normalized: String, val count: Long)
}
