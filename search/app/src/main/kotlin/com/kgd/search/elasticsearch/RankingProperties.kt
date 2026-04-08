package com.kgd.search.infrastructure.elasticsearch

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "search.ranking")
data class RankingProperties(
    val popularityWeight: Double = 10.0,
    val ctrWeight: Double = 5.0
)
