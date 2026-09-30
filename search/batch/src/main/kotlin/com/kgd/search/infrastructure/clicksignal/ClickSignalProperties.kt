package com.kgd.search.infrastructure.clicksignal

import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * 관광지 재색인이 클릭 신호를 읽는 ClickHouse 접속 (ADR-0095 §6 — analytics 집계 표 직접 읽기).
 *
 * 평가 잡의 `search.eval.*` 을 재사용하지 않는다 — 그 잡은 폐기됐고, 기본값이 localhost 라 운영에서
 * 설정을 빠뜨리면 매일 「읽기 실패 → 필드 비움」으로 조용히 떨어진다. CronJob 이 env 로 넣는다.
 */
@ConfigurationProperties(prefix = "search.click-signal")
data class ClickSignalProperties(
    val clickhouseUrl: String = "jdbc:clickhouse://localhost:8123/analytics",
    val clickhouseUser: String = "analytics",
    val clickhousePassword: String = "analytics",
)
