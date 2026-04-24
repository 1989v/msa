package com.kgd.quant

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication(scanBasePackages = ["com.kgd.quant", "com.kgd.common"])
class QuantApplication

fun main(args: Array<String>) {
    runApplication<QuantApplication>(*args)
}
