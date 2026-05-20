package com.kgd.search.infrastructure.eval

import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * ADR-0050 Phase 4 — Search Eval 잡 외부 설정.
 *
 * - [variant] : 평가 잡 식별자 — A/B 별 ConfigMap 두 벌 운영 시 "baseline" vs "experiment" 등
 * - [topK]    : 검색에서 가져올 top-K (default 10 — NDCG@10 산출 기준)
 * - [threshold] : MRR/Precision/MAP 에서 "relevant" 로 간주할 최소 relevance (default 1)
 * - [enabled] : 잡 실행 여부 (CronJob/ConfigMap 로 변경)
 * - [clickhouseUrl] / [user] / [password] : analytics 서비스의 ClickHouse 접속 정보
 */
@ConfigurationProperties(prefix = "search.eval")
data class EvalProperties(
    val enabled: Boolean = false,
    val variant: String = "baseline",
    val topK: Int = 10,
    val threshold: Int = 1,
    val clickhouseUrl: String = "jdbc:clickhouse://localhost:8123/analytics",
    val clickhouseUser: String = "analytics",
    val clickhousePassword: String = "analytics"
) {
    init {
        require(topK > 0) { "topK must be > 0" }
        require(threshold >= 1) { "threshold must be >= 1" }
    }
}
