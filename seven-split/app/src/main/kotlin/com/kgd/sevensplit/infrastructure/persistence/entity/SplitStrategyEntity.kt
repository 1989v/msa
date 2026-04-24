package com.kgd.sevensplit.infrastructure.persistence.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.math.BigDecimal
import java.time.Instant
import java.util.UUID

/**
 * TG-08.2: `split_strategy` 테이블에 1:1 매핑되는 JPA Entity.
 *
 * ## 도메인 ↔ Entity 분리 원칙
 * - 도메인 `SplitStrategy` 는 프레임워크 무지(clean architecture).
 * - 본 Entity 는 infrastructure 레이어에서만 사용되고, 변환은 Mapper 가 담당한다.
 *
 * ## JPA / Kotlin 주의
 * - kotlin-jpa 플러그인이 모든 Entity 클래스/필드를 open + no-arg 로 열어준다.
 * - 그러므로 `data class` 대신 일반 `class` + `var` 필드를 사용한다 (Hibernate proxy 대응).
 *
 * ## JSON 직렬화
 * - `take_profit_per_round` 는 `List<BigDecimal>` 을 Jackson JSON 문자열로 직렬화하여 `TEXT` 컬럼에 저장.
 *   Mapper 가 변환 책임을 진다 (AttributeConverter 대신 명시적 변환 — Phase 1 단순화).
 */
@Entity
@Table(name = "split_strategy")
class SplitStrategyEntity(
    @Id
    @Column(name = "strategy_id", columnDefinition = "BINARY(16)", nullable = false)
    var strategyId: UUID = UUID.randomUUID(),

    @Column(name = "tenant_id", nullable = false, length = 64)
    var tenantId: String = "",

    @Column(name = "target_symbol", nullable = false, length = 32)
    var targetSymbol: String = "",

    @Column(name = "round_count", nullable = false)
    var roundCount: Int = 0,

    @Column(name = "entry_gap_percent", nullable = false, precision = 18, scale = 8)
    var entryGapPercent: BigDecimal = BigDecimal.ZERO,

    @Column(name = "take_profit_per_round", nullable = false, columnDefinition = "TEXT")
    var takeProfitPerRoundJson: String = "[]",

    @Column(name = "initial_order_amount", nullable = false, precision = 38, scale = 8)
    var initialOrderAmount: BigDecimal = BigDecimal.ZERO,

    @Column(name = "execution_mode", nullable = false, length = 16)
    var executionMode: String = "",

    @Column(name = "status", nullable = false, length = 32)
    var status: String = "",

    @Column(name = "created_at", nullable = false)
    var createdAt: Instant = Instant.now(),

    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = Instant.now()
)
