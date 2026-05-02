package com.kgd.fulfillment

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.persistence.autoconfigure.EntityScan
import org.springframework.boot.runApplication
import org.springframework.data.jpa.repository.config.EnableJpaRepositories
import org.springframework.scheduling.annotation.EnableScheduling

/**
 * ADR-0032 Phase 0 — `com.kgd.common.messaging.outbox` 패키지에 위치한 [com.kgd.common.messaging.outbox.OutboxEntity]
 * 와 [com.kgd.common.messaging.outbox.OutboxRepository] 가 fulfillment 의 default scan 범위(`com.kgd.fulfillment`)
 * 에 들어가지 않으므로 `@EntityScan` / `@EnableJpaRepositories` 가 두 패키지를 명시한다.
 */
@SpringBootApplication(scanBasePackages = ["com.kgd.fulfillment", "com.kgd.common.exception", "com.kgd.common.response"])
@EntityScan(basePackages = ["com.kgd.fulfillment", "com.kgd.common.messaging.outbox"])
@EnableJpaRepositories(basePackages = ["com.kgd.fulfillment", "com.kgd.common.messaging.outbox"])
@EnableScheduling
class FulfillmentApplication

fun main(args: Array<String>) {
    runApplication<FulfillmentApplication>(*args)
}
