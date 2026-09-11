package com.kgd.quant.infrastructure.persistence

import tools.jackson.databind.ObjectMapper
import com.kgd.quant.domain.common.Clock
import com.kgd.quant.infrastructure.persistence.mapper.TrancheStrategyMapper
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import java.time.Instant

/**
 * TG-08: persistence 레이어의 수동 Bean 등록.
 *
 * - [TrancheStrategyMapper] 는 ObjectMapper 를 주입받으므로 @Configuration 에서 생성.
 * - [Clock] 기본 구현(`SystemClock`) 을 등록 — 테스트에서는 @Primary FakeClock 으로 override.
 * - [TransactionTemplate] 은 `JpaOutboxRepositoryAdapter` 가 @Modifying 쿼리를 위한 명시적 경계를 만들 때 사용.
 */
@Configuration
class PersistenceConfig {

    @Bean
    fun splitStrategyMapper(objectMapper: ObjectMapper): TrancheStrategyMapper =
        TrancheStrategyMapper(objectMapper)

    @Bean
    fun systemClock(): Clock = Clock { Instant.now() }

    @Bean
    // 폴드 후 한 JVM 에 TM 이 셋이다 — 타입으로 받으면 primary(quant)가 오기는 하나
    // primary 가 바뀌면 outbox 가 남의 트랜잭션 경계를 쓰게 된다. 이름으로 못박는다.
    fun outboxTransactionTemplate(
        @Qualifier("quantTransactionManager") transactionManager: PlatformTransactionManager,
    ): TransactionTemplate = TransactionTemplate(transactionManager)
}
