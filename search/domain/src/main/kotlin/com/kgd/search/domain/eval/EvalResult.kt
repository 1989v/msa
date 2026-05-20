package com.kgd.search.domain.eval

import java.time.Instant

data class EvalResult(
    val evalId: String,
    val variant: String,
    val query: String,
    val ndcg10: Double,
    val mrr: Double,
    val map10: Double,
    val precisionAt5: Double,
    val precisionAt10: Double,
    val resultSize: Int,
    val ts: Instant = Instant.now()
)
