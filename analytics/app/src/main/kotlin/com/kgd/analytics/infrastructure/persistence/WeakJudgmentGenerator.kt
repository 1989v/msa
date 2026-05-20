package com.kgd.analytics.infrastructure.persistence

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import javax.sql.DataSource

/**
 * ADR-0050 Phase 4 — analytics_events 로그에서 약지도 (weak supervision) judgment 자동 생성.
 *
 * 매핑:
 *  - ORDER_COMPLETE → relevance 3
 *  - ADD_TO_CART    → relevance 2
 *  - PRODUCT_CLICK  → relevance 1
 *  - 그 외          → 0 (저장 안 함)
 *
 * 같은 (query, product_id) 가 중복 INSERT 되어도 ReplacingMergeTree(created_at) 가
 * 최신 행만 머지 시 유지. source='weak' 로 표기.
 *
 * Cron: daily 03:00 (운영 ConfigMap 으로 외부화).
 * 비활성화: `analytics.judgment.weak.enabled=false`
 */
@Component
class WeakJudgmentGenerator(
    private val dataSource: DataSource,
    @Value("\${analytics.judgment.weak.enabled:false}") private val enabled: Boolean,
    @Value("\${analytics.judgment.weak.lookback-days:30}") private val lookbackDays: Int
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @Scheduled(cron = "\${analytics.judgment.weak.cron:0 0 3 * * *}")
    fun generate() {
        if (!enabled) {
            log.debug("Weak judgment generator disabled")
            return
        }
        runCatching {
            dataSource.connection.use { conn ->
                conn.createStatement().use { stmt ->
                    stmt.execute(
                        """
                        INSERT INTO analytics.search_judgments
                            (query, product_id, relevance, source, weight, created_at)
                        SELECT
                            keyword                       AS query,
                            toString(product_id)          AS product_id,
                            multiIf(
                                event_type = 'ORDER_COMPLETE', 3,
                                event_type = 'ADD_TO_CART',   2,
                                event_type = 'PRODUCT_CLICK', 1,
                                0
                            )                              AS relevance,
                            'weak'                         AS source,
                            1.0                            AS weight,
                            now()                          AS created_at
                        FROM analytics.events
                        WHERE timestamp >= now() - INTERVAL $lookbackDays DAY
                          AND keyword IS NOT NULL AND keyword != ''
                          AND product_id IS NOT NULL
                          AND event_type IN ('ORDER_COMPLETE', 'ADD_TO_CART', 'PRODUCT_CLICK')
                        """.trimIndent()
                    )
                }
            }
            log.info("Weak judgment generated: lookbackDays={}", lookbackDays)
        }.onFailure { log.error("Weak judgment generation failed", it) }
    }
}
