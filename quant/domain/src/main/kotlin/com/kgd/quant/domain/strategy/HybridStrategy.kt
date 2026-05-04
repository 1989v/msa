package com.kgd.quant.domain.strategy

import com.kgd.quant.domain.asset.Asset
import com.kgd.quant.domain.common.StrategyId
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.market.Market
import java.time.Instant

/**
 * HybridStrategy — 분할 진입(Tranche) + 시그널 합성 전략 (ADR-0033 Phase 3 도메인, Phase 1 후반 도입).
 *
 * ## 합성 의미
 * - 분할 진입(tranche) 회차 진입가는 [trancheBase] 의 분할 규칙을 따른다 (gap percent / round count).
 * - 단, 진입 전제는 [signalGate] 가 trigger 되어 있어야 한다 (시그널 게이트로 진입 시점 필터).
 * - 청산은 분할 진입의 회차별 익절 규칙을 따른다 (시그널 청산은 Phase 3 옵션).
 *
 * ## Phase 1 범위
 * 도메인 모델 + 백테스트 시퀀스 placeholder. 실제 평가 로직(시그널 게이트가 활성화된 봉에서
 * 분할 회차 진입을 시작) 은 Phase 3 RunHybridBacktestUseCase 에서 구현.
 *
 * ## 불변식
 * - [trancheBase] 와 [signalGate] 의 [Asset] / [Market] 이 일치해야 한다 — 두 strategy 가
 *   다른 자산을 가리키는 합성은 의미 없음.
 */
data class HybridStrategy(
    override val id: StrategyId,
    override val tenantId: TenantId,
    val asset: Asset,
    val market: Market,
    /** 분할 진입 베이스 — 회차/gap/익절 규칙. */
    val trancheBase: TrancheStrategy,
    /** 진입 게이트 — 본 시그널이 triggered 일 때만 trancheBase 진입 시작. */
    val signalGate: SignalStrategy,
    val createdAt: Instant,
) : Strategy {
    init {
        require(trancheBase.tenantId == tenantId) { "trancheBase tenantId mismatch" }
        require(signalGate.tenantId == tenantId) { "signalGate tenantId mismatch" }
        require(signalGate.asset == asset) { "signalGate asset must match HybridStrategy asset" }
        require(signalGate.market == market) { "signalGate market must match HybridStrategy market" }
    }

    fun describe(): String =
        "Hybrid[asset=${asset.code}@${market.code}, gate=${signalGate.entrySignal.describe()}, tranche=${trancheBase.id.value}]"
}
