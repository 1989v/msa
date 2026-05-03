package com.kgd.quant.infrastructure.persistence.adapter

import com.kgd.quant.application.port.persistence.BacktestRunRecord
import com.kgd.quant.application.port.persistence.BacktestRunRepositoryPort
import com.kgd.quant.domain.common.RunId
import com.kgd.quant.domain.common.StrategyId
import com.kgd.quant.domain.common.TenantId
import org.springframework.stereotype.Component
import java.util.concurrent.ConcurrentHashMap

/**
 * ⚠️ TEMPORARY — `BacktestRunRepositoryPort` 의 in-memory stub.
 *
 * 정식 구현은 ClickHouse `quant.backtest_run` (ReplacingMergeTree) 기반의
 * `ClickHouseBacktestRunRepositoryAdapter` 가 되어야 한다 (BacktestRunRepositoryPort
 * docstring §배치 위치 참조). 그러나 ClickHouse JDBC + spec.md §5/TG-06 의 마이그레이션
 * 도입이 사용자 진행 작업 영역이므로, 본 stub 은 ApplicationContext 시작만 가능하게 한다.
 *
 * ## 한계
 * - 프로세스 메모리에 보관 — 재시작 시 데이터 소실.
 * - tenantId 격리(INV-05)는 키에 포함시켜 흉내냄.
 * - Concurrent 안전성만 보장 (`ConcurrentHashMap`).
 *
 * TODO(removal): ClickHouse 어댑터 구현 후 본 클래스 + Component 등록 즉시 제거.
 */
@Component
class StubBacktestRunRepositoryAdapter : BacktestRunRepositoryPort {

    private val store = ConcurrentHashMap<Pair<String, RunId>, BacktestRunRecord>()

    override suspend fun save(run: BacktestRunRecord): BacktestRunRecord {
        store[run.tenantId.value to run.runId] = run
        return run
    }

    override suspend fun findById(tenantId: TenantId, id: RunId): BacktestRunRecord? =
        store[tenantId.value to id]

    override suspend fun findCompletedByStrategy(
        tenantId: TenantId,
        strategyId: StrategyId,
    ): List<BacktestRunRecord> = store.values
        .filter { it.tenantId == tenantId && it.strategyId == strategyId }
}
