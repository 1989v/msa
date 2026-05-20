package com.kgd.search

import com.kgd.search.infrastructure.eval.EvalProperties
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.runApplication

@SpringBootApplication
@EnableConfigurationProperties(EvalProperties::class)
class SearchBatchApplication

fun main(args: Array<String>) {
    runApplication<SearchBatchApplication>(*args)
}
