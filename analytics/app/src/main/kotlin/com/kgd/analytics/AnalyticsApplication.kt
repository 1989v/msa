package com.kgd.analytics

import com.kgd.analytics.infrastructure.streaming.GmvAggregationProperties
import com.kgd.analytics.infrastructure.streaming.SmoothingProperties
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.runApplication

@SpringBootApplication(scanBasePackages = ["com.kgd.analytics", "com.kgd.common"])
@EnableConfigurationProperties(SmoothingProperties::class, GmvAggregationProperties::class)
class AnalyticsApplication

fun main(args: Array<String>) {
    runApplication<AnalyticsApplication>(*args)
}
