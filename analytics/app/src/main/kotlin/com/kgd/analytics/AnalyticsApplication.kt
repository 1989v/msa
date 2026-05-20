package com.kgd.analytics

import com.kgd.analytics.infrastructure.streaming.GmvAggregationProperties
import com.kgd.analytics.infrastructure.streaming.SmoothingProperties
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableScheduling

@SpringBootApplication(scanBasePackages = ["com.kgd.analytics", "com.kgd.common"])
@EnableConfigurationProperties(SmoothingProperties::class, GmvAggregationProperties::class)
@EnableScheduling
class AnalyticsApplication

fun main(args: Array<String>) {
    runApplication<AnalyticsApplication>(*args)
}
