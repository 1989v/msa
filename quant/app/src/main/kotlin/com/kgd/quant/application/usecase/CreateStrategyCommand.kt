package com.kgd.quant.application.usecase

import com.kgd.quant.domain.common.ExecutionMode
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.strategy.TrancheStrategyConfig

/**
 * CreateStrategyCommand — 신규 전략 생성 요청 DTO.
 *
 * Presentation 레이어가 REST 요청 body 를 이 명령으로 매핑해서 UseCase 에 전달한다.
 * INV-07 검증은 `TrancheStrategyConfig` 생성자가 담당하므로 UseCase 는 그대로 위임만 한다.
 */
data class CreateStrategyCommand(
    val tenantId: TenantId,
    val config: TrancheStrategyConfig,
    val executionMode: ExecutionMode
)
