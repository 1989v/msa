package com.kgd.payment.infrastructure.pg.mock

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

/** 모의 PG 의 호출 기록기 — 모의 PG 와 같은 조건(`payment.pg=mock` 또는 미설정)으로만 생긴다 */
@Configuration
@ConditionalOnProperty(prefix = "payment", name = ["pg"], havingValue = "mock", matchIfMissing = true)
class MockPgConfig {
    @Bean
    fun mockPgCallRecorder(): MockPgCallRecorder = MockPgCallRecorder()
}
