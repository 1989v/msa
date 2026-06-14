package com.kgd.search.infrastructure.opensearch

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "search.ranking")
data class RankingProperties(
    val popularityWeight: Double = 10.0,
    val ctrWeight: Double = 5.0,
    val cvrWeight: Double = 0.0,
    val gmv7dWeight: Double = 0.0,
    val gmv30dWeight: Double = 0.0,
    val freshness: FreshnessConfig = FreshnessConfig()
)

data class FreshnessConfig(
    val weight: Double = 0.0,
    val origin: String = "now",
    val scale: String = "14d",
    val offset: String = "0d",
    val decay: Double = 0.5
)
