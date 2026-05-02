package com.kgd.order

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.persistence.autoconfigure.EntityScan
import org.springframework.boot.runApplication
import org.springframework.data.jpa.repository.config.EnableJpaRepositories
import org.springframework.scheduling.annotation.EnableScheduling

/**
 * ADR-0032 PR-2 — `com.kgd.common.messaging.outbox` 패키지에 위치한
 * [com.kgd.common.messaging.outbox.OutboxEntity] / [com.kgd.common.messaging.outbox.OutboxRepository]
 * 가 order 의 default scan 범위(`com.kgd.order`) 에 들어가지 않으므로
 * `@EntityScan` / `@EnableJpaRepositories` 가 두 패키지를 명시한다.
 */
@SpringBootApplication
@EntityScan(basePackages = ["com.kgd.order", "com.kgd.common.messaging.outbox"])
@EnableJpaRepositories(basePackages = ["com.kgd.order", "com.kgd.common.messaging.outbox"])
@EnableScheduling
class OrderApplication

fun main(args: Array<String>) {
    runApplication<OrderApplication>(*args)
}
