package com.kgd.search

import com.kgd.search.bandit.BanditProperties
import com.kgd.search.infrastructure.elasticsearch.RankingProperties
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.runApplication
import org.springframework.kafka.annotation.EnableKafka

@SpringBootApplication
@EnableConfigurationProperties(RankingProperties::class, BanditProperties::class)
@EnableKafka
class SearchApplication

fun main(args: Array<String>) {
    runApplication<SearchApplication>(*args)
}
