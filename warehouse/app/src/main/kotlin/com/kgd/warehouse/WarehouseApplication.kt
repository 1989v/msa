package com.kgd.warehouse

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication(scanBasePackages = ["com.kgd.warehouse", "com.kgd.common.exception", "com.kgd.common.response"])
class WarehouseApplication

fun main(args: Array<String>) {
    runApplication<WarehouseApplication>(*args)
}
