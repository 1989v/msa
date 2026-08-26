package com.kgd.quant.application.usecase

import com.kgd.quant.application.view.BacktestRunResultView

/** 백테스트 1회 실행 — 엔진·ClickHouse 저장은 DB 트랜잭션 밖 (ADR-0020) */
interface RunBacktestUseCase {
    suspend fun execute(command: RunBacktestCommand): BacktestRunResultView
}
