package com.kgd.quant.domain.strategy

import com.kgd.quant.domain.common.StrategyId
import com.kgd.quant.domain.common.TenantId

/**
 * Strategy — 통합 플랫폼의 전략 sealed marker (ADR-0033).
 *
 * 모든 전략 타입은 본 marker 를 구현해야 한다. 자식:
 *
 * - [TrancheStrategy] — 분할 진입(tranche) 전략 (기존 Phase 1/2 그대로)
 * - [SignalStrategy]  — single-source 시그널 기반 전략 (Phase 1 신규)
 * - [HybridStrategy]  — Tranche + Signal 합성 (Phase 3)
 *
 * marker 는 각 전략 타입의 공통 식별자 (id, tenantId) 만 노출한다. 자산/거래소 정보는
 * 자식이 자신의 도메인 의미에 맞게 보유한다 — TrancheStrategy 는 `config` 안에,
 * SignalStrategy 는 [SignalStrategy.asset] / [SignalStrategy.market] 으로 직접 보유.
 */
sealed interface Strategy {
    val id: StrategyId
    val tenantId: TenantId
}
