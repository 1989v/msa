package com.kgd.sevensplit.application.usecase

import com.kgd.sevensplit.domain.common.ExecutionMode
import com.kgd.sevensplit.domain.common.TenantId
import com.kgd.sevensplit.domain.strategy.SplitStrategyConfig

/**
 * CreateStrategyCommand — 신규 전략 생성 요청 DTO.
 *
 * Presentation 레이어가 REST 요청 body 를 이 명령으로 매핑해서 UseCase 에 전달한다.
 * INV-07 검증은 `SplitStrategyConfig` 생성자가 담당하므로 UseCase 는 그대로 위임만 한다.
 */
data class CreateStrategyCommand(
    val tenantId: TenantId,
    val config: SplitStrategyConfig,
    val executionMode: ExecutionMode
)
