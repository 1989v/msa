package com.kgd.product

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.persistence.autoconfigure.EntityScan
import org.springframework.boot.runApplication

@SpringBootApplication
// processed_event 엔티티는 common 이 한 벌만 갖는다 — 기본 스캔(com.kgd.product)에 안 잡히므로 명시
@EntityScan(basePackages = ["com.kgd.product", "com.kgd.common.messaging.idempotency"])
class ProductApplication

fun main(args: Array<String>) {
    runApplication<ProductApplication>(*args)
}
