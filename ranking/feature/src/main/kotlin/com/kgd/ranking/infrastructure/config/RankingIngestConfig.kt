package com.kgd.ranking.infrastructure.config

import com.kgd.common.observability.IngestFreshness
import com.kgd.ranking.infrastructure.persistence.repository.GasStationPriceJpaRepository
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import java.time.Duration

@Configuration
class RankingIngestConfig {

    /** 일 1회 수집이라 이틀 연속 실패까지 허용한다. */
    @Bean
    fun gasPriceIngestFreshness(prices: GasStationPriceJpaRepository) =
        IngestFreshness(
            job = "ranking-ingest-gas",
            schedule = "0 20 * * *",
            maxAge = Duration.ofHours(72),
            lastIngestedAt = prices::findLatestUpdatedAt,
        )
}
