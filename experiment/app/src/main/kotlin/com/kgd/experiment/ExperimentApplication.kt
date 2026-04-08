package com.kgd.experiment

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication(scanBasePackages = ["com.kgd.experiment", "com.kgd.common"])
class ExperimentApplication

fun main(args: Array<String>) {
    runApplication<ExperimentApplication>(*args)
}
