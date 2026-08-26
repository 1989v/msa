package com.kgd.search

import com.kgd.search.application.ranking.config.BanditProperties
import com.kgd.search.application.ranking.config.DiversityProperties
import com.kgd.search.infrastructure.client.SearchExperimentProperties
import com.kgd.search.infrastructure.opensearch.AttractionRankingProperties
import com.kgd.search.infrastructure.opensearch.RankingProperties
import com.kgd.search.infrastructure.opensearch.RankingVariantsProperties
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.runApplication
import org.springframework.kafka.annotation.EnableKafka

@SpringBootApplication
@EnableConfigurationProperties(
    RankingProperties::class,
    RankingVariantsProperties::class,
    BanditProperties::class,
    DiversityProperties::class,
    SearchExperimentProperties::class,
    AttractionRankingProperties::class,
)
@EnableKafka
class SearchApplication

fun main(args: Array<String>) {
    runApplication<SearchApplication>(*args)
}
