package com.kgd.sevensplit.application.backtest

import java.math.BigDecimal

/**
 * BacktestConfig — 백테스트 실행 파라미터.
 *
 * Phase 1 은 가장 단순한 형태: seed / 초기 잔고 / slippage 만 취급한다.
 * 수수료·funding·VWAP partial fill 은 Phase 2+ 에서 확장.
 *
 * @property seed 결정론 보장을 위한 난수 시드 (이벤트/OrderId 생성에 사용)
 * @property initialBalance 가상 계좌 초기 잔고 (KRW 기준)
 * @property slippagePercent 체결가에 적용할 slippage. 기본 0.
 */
data class BacktestConfig(
    val seed: Long,
    val initialBalance: BigDecimal,
    val slippagePercent: BigDecimal = BigDecimal.ZERO
)
