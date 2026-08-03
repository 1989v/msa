package com.kgd.place

import com.kgd.place.infrastructure.config.PlaceSeedProperties
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.runApplication

@SpringBootApplication(scanBasePackages = ["com.kgd.place", "com.kgd.common.exception", "com.kgd.common.response"])
@EnableConfigurationProperties(PlaceSeedProperties::class)
class PlaceApplication

fun main(args: Array<String>) {
    runApplication<PlaceApplication>(*args)
}
