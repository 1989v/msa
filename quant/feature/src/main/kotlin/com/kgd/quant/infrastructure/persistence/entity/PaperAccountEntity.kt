package com.kgd.quant.infrastructure.persistence.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Index
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint
import java.math.BigDecimal
import java.time.Instant
import java.util.UUID

/**
 * TG-P2-08: `paper_account` JPA Entity.
 *
 * ## 도메인 분리
 * - PaperAccount 는 Phase 2 인프라 개념이며 도메인 모델 (`TrancheStrategy`, `TrancheSlot`) 과 직접
 *   결합하지 않는다. UseCase 가 `(tenantId, strategyId)` 로 직접 조회/조정한다.
 *
 * ## INV-P2-09
 * - PaperAccount.balance 는 ExchangeCredential 의 실거래소 잔고와 격리된 가상 잔고이다.
 * - PAPER 모드 전용. LIVE 모드는 거래소 API 잔고를 직접 조회한다.
 *
 * ## Kotlin / JPA 주의
 * - kotlin-jpa 플러그인이 open + no-arg 를 자동 생성. data class 대신 일반 class + var 필드 사용.
 */
@Entity
@Table(
    name = "paper_account",
    uniqueConstraints = [
        UniqueConstraint(
            name = "uk_paper_account_strategy",
            columnNames = ["tenant_id", "strategy_id", "base_asset"]
        )
    ],
    indexes = [
        Index(name = "idx_paper_account_tenant", columnList = "tenant_id, strategy_id")
    ]
)
class PaperAccountEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "paper_account_id", nullable = false)
    var paperAccountId: Long = 0,

    @Column(name = "tenant_id", nullable = false, length = 64)
    var tenantId: String = "",

    @Column(name = "strategy_id", columnDefinition = "BINARY(16)", nullable = false)
    var strategyId: UUID = UUID.randomUUID(),

    @Column(name = "base_asset", nullable = false, length = 16)
    var baseAsset: String = "KRW",

    @Column(name = "balance", nullable = false, precision = 28, scale = 8)
    var balance: BigDecimal = BigDecimal.ZERO,

    @Column(name = "created_at", nullable = false)
    var createdAt: Instant = Instant.now(),

    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = Instant.now()
)
