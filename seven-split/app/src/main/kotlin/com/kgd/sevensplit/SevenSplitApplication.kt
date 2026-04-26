package com.kgd.sevensplit

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableScheduling

@SpringBootApplication(scanBasePackages = ["com.kgd.sevensplit", "com.kgd.common"])
@EnableScheduling  // TG-08.6: OutboxRelay @Scheduled 활성화
class SevenSplitApplication

fun main(args: Array<String>) {
    runApplication<SevenSplitApplication>(*args)
}
