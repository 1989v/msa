package com.kgd.sevensplit

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication(scanBasePackages = ["com.kgd.sevensplit", "com.kgd.common"])
class SevenSplitApplication

fun main(args: Array<String>) {
    runApplication<SevenSplitApplication>(*args)
}
