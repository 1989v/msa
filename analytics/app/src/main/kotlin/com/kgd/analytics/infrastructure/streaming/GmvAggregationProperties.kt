package com.kgd.analytics.infrastructure.streaming

import org.springframework.boot.context.properties.ConfigurationProperties
import java.time.Duration

/**
 * ADR-0050 Phase 2 — GMV 7d / 30d 누적 합 계산 외부 설정.
 *
 * 분리된 두 window 를 두는 이유는 단기 트렌드(7d) 와 안정 매출(30d) 을
 * 분리해 ranking weight 운영에서 A/B 할 수 있게 함 (Q4).
 */
@ConfigurationProperties(prefix = "analytics.gmv-aggregation")
data class GmvAggregationProperties(
    val enabled: Boolean = false,
    val shortWindow: Duration = Duration.ofDays(7),
    val longWindow: Duration = Duration.ofDays(30)
)
