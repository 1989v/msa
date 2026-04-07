package com.kgd.fulfillment

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableScheduling

@SpringBootApplication(scanBasePackages = ["com.kgd.fulfillment", "com.kgd.common.exception", "com.kgd.common.response"])
@EnableScheduling
class FulfillmentApplication

fun main(args: Array<String>) {
    runApplication<FulfillmentApplication>(*args)
}
