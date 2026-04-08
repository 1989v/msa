package com.kgd.search

import com.kgd.search.infrastructure.elasticsearch.RankingProperties
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.runApplication

@SpringBootApplication
@EnableConfigurationProperties(RankingProperties::class)
class SearchApplication

fun main(args: Array<String>) {
    runApplication<SearchApplication>(*args)
}
