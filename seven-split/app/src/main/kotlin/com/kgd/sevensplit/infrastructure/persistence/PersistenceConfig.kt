package com.kgd.sevensplit.infrastructure.persistence

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.sevensplit.domain.common.Clock
import com.kgd.sevensplit.infrastructure.persistence.mapper.SplitStrategyMapper
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import java.time.Instant

/**
 * TG-08: persistence 레이어의 수동 Bean 등록.
 *
 * - [SplitStrategyMapper] 는 ObjectMapper 를 주입받으므로 @Configuration 에서 생성.
 * - [Clock] 기본 구현(`SystemClock`) 을 등록 — 테스트에서는 @Primary FakeClock 으로 override.
 * - [TransactionTemplate] 은 `JpaOutboxRepositoryAdapter` 가 @Modifying 쿼리를 위한 명시적 경계를 만들 때 사용.
 */
@Configuration
class PersistenceConfig {

    @Bean
    fun splitStrategyMapper(objectMapper: ObjectMapper): SplitStrategyMapper =
        SplitStrategyMapper(objectMapper)

    @Bean
    fun systemClock(): Clock = Clock { Instant.now() }

    @Bean
    fun outboxTransactionTemplate(transactionManager: PlatformTransactionManager): TransactionTemplate =
        TransactionTemplate(transactionManager)
}
