package com.kgd.sevensplit.application.usecase

import com.kgd.sevensplit.application.port.persistence.StrategyRepositoryPort
import com.kgd.sevensplit.domain.common.StrategyId
import com.kgd.sevensplit.domain.strategy.SplitStrategy
import org.springframework.stereotype.Component

/**
 * CreateStrategyUseCase — 신규 `SplitStrategy` 생성.
 *
 * ## 흐름
 *  1. `SplitStrategy.create(...)` — 팩토리가 INV-07 을 포함한 도메인 불변식을 검증.
 *  2. `StrategyRepositoryPort.save(...)` — 어댑터가 짧은 트랜잭션으로 저장.
 *
 * ## 트랜잭션 (ADR-0020)
 * - UseCase 메서드에는 `@Transactional` 을 걸지 않는다. `save` 가 자체 트랜잭션을 가진다.
 * - 외부 IO (Kafka, ClickHouse) 가 없으므로 단일 짧은 트랜잭션으로 충분.
 */
@Component
class CreateStrategyUseCase(
    private val strategyRepository: StrategyRepositoryPort
) {
    suspend fun execute(command: CreateStrategyCommand): StrategyId {
        val strategy = SplitStrategy.create(
            tenantId = command.tenantId,
            config = command.config,
            executionMode = command.executionMode
        )
        val saved = strategyRepository.save(strategy)
        return saved.id
    }
}
