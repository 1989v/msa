package com.kgd.sevensplit.application.port.exchange

import com.kgd.sevensplit.domain.common.TenantId
import com.kgd.sevensplit.domain.credential.Exchange
import com.kgd.sevensplit.domain.order.Execution
import com.kgd.sevensplit.domain.order.OrderAck
import com.kgd.sevensplit.domain.order.OrderCommand
import java.math.BigDecimal
import java.util.UUID

/**
 * ExchangeAdapter — 거래소 실행 port.
 *
 * ## 배치 위치
 * Application 레이어. UseCase 가 `ExecutionMode`에 따라 구현체를 선택한다 (spec.md §4).
 *
 * ## 공통 구현체
 * - `BacktestExchangeAdapter` (Phase 1, TG-05) — 가상 체결, slippage 0.
 * - `SimulatedExchangeAdapter` (Phase 2, 페이퍼) — 실시간 시세 기반 가상 체결.
 * - `BithumbExchangeAdapter`, `UpbitExchangeAdapter` (Phase 3, 실매매).
 *
 * ## 계약
 * - 모든 메서드는 `suspend`. 실구현은 Coroutine + WebClient (ADR-0002).
 * - `placeOrder` 는 `OrderCommand.orderId` 를 client order id 로 사용해 거래소 레벨 멱등 보장
 *   (INV-06, ADR-0012).
 * - 네트워크/거래소 오류 시 `ExchangeException` (infra 레벨) 을 던지고 UseCase 가 CircuitBreaker
 *   /재시도 정책을 적용한다 (ADR-0015).
 * - `fetchExecution` 은 미체결(`ACCEPTED`/`SUBMITTED`) 주문에 대해 `null` 을 반환할 수 있다.
 */
interface ExchangeAdapter {
    /** 이 어댑터가 담당하는 거래소. 구현체에서 고정값으로 제공. */
    val exchange: Exchange

    /** 신규 주문 접수 — `OrderCommand.orderId` 로 멱등 보장. */
    suspend fun placeOrder(tenantId: TenantId, command: OrderCommand): OrderAck

    /** 거래소에 접수된 주문 취소. 이미 체결/취소된 경우 no-op (구현체가 흡수). */
    suspend fun cancelOrder(tenantId: TenantId, exchangeOrderId: String)

    /** 특정 심볼의 가용 잔고 조회 (예: "BTC" → 0.5). */
    suspend fun fetchBalance(tenantId: TenantId, symbol: String): BigDecimal

    /**
     * 단건 주문의 최신 체결 상태 조회.
     * @return 체결이 한 건도 없으면 null, 아니면 가장 최근 `Execution`.
     */
    suspend fun fetchExecution(tenantId: TenantId, orderId: UUID): Execution?
}
