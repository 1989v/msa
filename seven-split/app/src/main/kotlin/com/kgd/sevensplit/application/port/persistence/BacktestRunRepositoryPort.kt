package com.kgd.sevensplit.application.port.persistence

import com.kgd.sevensplit.domain.common.RunId
import com.kgd.sevensplit.domain.common.StrategyId
import com.kgd.sevensplit.domain.common.TenantId
import java.math.BigDecimal
import java.time.Instant

/**
 * BacktestRunRepositoryPort — 백테스트 실행 결과 집계 영속화 port.
 *
 * ## 배치 위치
 * Application 레이어. 구현체는 ClickHouse `seven_split.backtest_run` (spec.md §5, TG-06).
 *
 * ## 계약
 * - 모든 조회 시그니처에 `tenantId` 포함 (INV-05).
 * - `findCompletedByStrategy` 는 endedAt 가 세팅된 run 만 반환(리더보드 입력).
 * - `save` 는 append-only — 동일 `runId` 에 대해 결과 갱신이 필요하면 새 row 로 기록하는 것을
 *   구현체가 결정 (ClickHouse ReplacingMergeTree).
 */
interface BacktestRunRepositoryPort {
    suspend fun save(run: BacktestRunRecord): BacktestRunRecord
    suspend fun findById(tenantId: TenantId, id: RunId): BacktestRunRecord?
    suspend fun findCompletedByStrategy(tenantId: TenantId, strategyId: StrategyId): List<BacktestRunRecord>
}

/**
 * BacktestRunRecord — 백테스트 실행 메타 + 결과 집계.
 *
 * 도메인 entity 가 아닌 application/read-model 레벨의 DTO (ClickHouse 행에 대응).
 * 도메인 `StrategyRun` 과는 책임이 다르다: 이 레코드는 백테스트 결과 스냅샷.
 */
data class BacktestRunRecord(
    val runId: RunId,
    val tenantId: TenantId,
    val strategyId: StrategyId,
    val symbol: String,
    val configJson: String,
    val seed: Long,
    val from: Instant,
    val to: Instant,
    val realizedPnl: BigDecimal,
    val mdd: BigDecimal,
    val sharpe: BigDecimal,
    val fillCount: Long,
    val startedAt: Instant,
    val endedAt: Instant
)
