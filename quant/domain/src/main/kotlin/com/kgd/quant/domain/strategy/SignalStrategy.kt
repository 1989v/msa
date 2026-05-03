package com.kgd.quant.domain.strategy

import com.kgd.quant.domain.asset.Asset
import com.kgd.quant.domain.common.StrategyId
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.market.Market
import java.time.Instant

/**
 * SignalStrategy — single-source 시그널 기반 자동매매 전략 (ADR-0033 Phase 1).
 *
 * Phase 1 은 단일 거래소(빗썸) + 단일 시그널만 평가한다 (사용자 결정 — Q5 = C).
 * 김치프리미엄 / cross-exchange 시그널은 Phase 2.
 *
 * ## 불변식
 * - [market] 은 [asset] 의 [com.kgd.quant.domain.asset.AssetClass] 를 지원해야 한다 (생성 시점 검증).
 * - [exitSignal] 이 명시되지 않으면 strategy 는 진입만 수행하고 청산은 외부 신호(수동/리스크 한도) 에 위임.
 *
 * ## 상태
 * 본 Phase 1 구현은 [TrancheStrategy] 와 달리 단순 정의(Definition) 모델이다 — paper trading
 * run 단위로 별도 [com.kgd.quant.domain.common.RunId] 를 부여받는다. 상태 머신은 Phase 2 의
 * 활성/일시정지/청산 전이 도입 시 재검토.
 */
data class SignalStrategy(
    override val id: StrategyId,
    override val tenantId: TenantId,
    val asset: Asset,
    val market: Market,
    val entrySignal: SignalConfig,
    val exitSignal: SignalConfig?,
    val sizing: PositionSizing,
    val createdAt: Instant,
) : Strategy {
    init {
        require(market.supports(asset.assetClass)) {
            "Market ${market.code} does not support AssetClass ${asset.assetClass}"
        }
    }

    fun describe(): String = buildString {
        append("SignalStrategy[")
        append(asset.code)
        append("@")
        append(market.code)
        append(", entry=")
        append(entrySignal.describe())
        if (exitSignal != null) {
            append(", exit=")
            append(exitSignal.describe())
        }
        append(", sizing=")
        append(sizing.describe())
        append("]")
    }
}
