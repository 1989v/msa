package com.kgd.quant

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.ConfigurationPropertiesScan
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableScheduling

@SpringBootApplication(scanBasePackages = ["com.kgd.quant", "com.kgd.common"])
@ConfigurationPropertiesScan(basePackages = ["com.kgd.quant"])
@EnableScheduling  // TG-08.6: OutboxRelay @Scheduled 활성화
class QuantApplication

fun main(args: Array<String>) {
    runApplication<QuantApplication>(*args)
}
