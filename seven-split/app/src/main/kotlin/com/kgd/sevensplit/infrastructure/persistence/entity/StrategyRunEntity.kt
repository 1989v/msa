package com.kgd.sevensplit.infrastructure.persistence.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

/**
 * TG-08.2: `strategy_run` 테이블 매핑 Entity.
 *
 * 한 `SplitStrategy` 는 N 개의 실행(run) 을 가진다. 상태 전이는 도메인 `StrategyRun`
 * aggregate 가 관리하고, 본 Entity 는 스냅샷 저장만 담당한다.
 */
@Entity
@Table(name = "strategy_run")
class StrategyRunEntity(
    @Id
    @Column(name = "run_id", columnDefinition = "BINARY(16)", nullable = false)
    var runId: UUID = UUID.randomUUID(),

    @Column(name = "strategy_id", columnDefinition = "BINARY(16)", nullable = false)
    var strategyId: UUID = UUID.randomUUID(),

    @Column(name = "tenant_id", nullable = false, length = 64)
    var tenantId: String = "",

    @Column(name = "execution_mode", nullable = false, length = 16)
    var executionMode: String = "",

    @Column(name = "seed", nullable = false)
    var seed: Long = 0,

    @Column(name = "status", nullable = false, length = 32)
    var status: String = "",

    @Column(name = "end_reason", nullable = true, length = 32)
    var endReason: String? = null,

    @Column(name = "started_at", nullable = false)
    var startedAt: Instant = Instant.now(),

    @Column(name = "ended_at", nullable = true)
    var endedAt: Instant? = null
)
