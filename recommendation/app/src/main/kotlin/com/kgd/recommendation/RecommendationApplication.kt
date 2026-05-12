package com.kgd.recommendation

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication(scanBasePackages = ["com.kgd.recommendation", "com.kgd.common"])
class RecommendationApplication

fun main(args: Array<String>) {
    runApplication<RecommendationApplication>(*args)
}
