package com.kgd.search.infrastructure.opensearch

import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * ADR-0050 Phase 4 — variant 별 RankingProperties 묶음. SearchDebugController 에서
 * `?variant=experiment_a` 형태로 선택.
 *
 * application.yml 예시:
 * ```
 * search:
 *   ranking-variants:
 *     variants:
 *       experiment_a:
 *         popularity-weight: 10.0
 *         ctr-weight: 8.0
 *         cvr-weight: 3.0
 *         freshness: { weight: 1.0, scale: 14d, decay: 0.5 }
 *       experiment_b:
 *         popularity-weight: 5.0
 *         ctr-weight: 10.0
 *         gmv7d-weight: 2.0
 * ```
 *
 * 빈 map 이면 `live` 단일 (default RankingProperties) 만 사용.
 */
@ConfigurationProperties(prefix = "search.ranking-variants")
data class RankingVariantsProperties(
    val variants: Map<String, RankingProperties> = emptyMap()
)
