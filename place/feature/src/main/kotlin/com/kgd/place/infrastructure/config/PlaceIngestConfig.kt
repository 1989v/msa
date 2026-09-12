package com.kgd.place.infrastructure.config

import com.kgd.common.observability.IngestFreshness
import com.kgd.place.infrastructure.persistence.attraction.repository.AttractionJpaRepository
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import java.time.Duration
import java.time.ZoneOffset

@Configuration
class PlaceIngestConfig {

    /** 일 1회 수집이라 이틀 연속 실패까지 허용한다. */
    @Bean
    fun attractionIntroIngestFreshness(attractions: AttractionJpaRepository) =
        IngestFreshness(
            job = "place-ingest-intro",
            schedule = "0 20 * * *",
            maxAge = Duration.ofHours(72),
        ) {
            attractions.findLatestIntroSyncedAt()?.toInstant(ZoneOffset.UTC)
        }
}
