package com.kgd.quant.infrastructure.exchange

import com.kgd.quant.application.paper.port.PaperAccountRepositoryPort
import com.kgd.quant.application.port.exchange.ExchangeAdapter
import com.kgd.quant.application.port.exchange.SlippageModel
import com.kgd.quant.application.port.marketdata.Symbol
import com.kgd.quant.domain.common.Clock
import com.kgd.quant.domain.common.Price
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.credential.Exchange
import com.kgd.quant.domain.event.EventPublisher
import com.kgd.quant.domain.event.OrderFilled
import com.kgd.quant.domain.order.Execution
import com.kgd.quant.domain.order.OrderAck
import com.kgd.quant.domain.order.OrderCommand
import com.kgd.quant.domain.order.OrderSide
import com.kgd.quant.application.market.MarketDataHub
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.delay
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Profile
import org.springframework.stereotype.Component
import java.math.BigDecimal
import java.security.SecureRandom
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

private val logger = KotlinLogging.logger {}

/**
 * PaperExchangeAdapter — 페이퍼 트레이딩용 가상 거래소 어댑터 (TG-P2-08).
 *
 * ## 동작
 * 1. 동일 `OrderCommand.orderId` 재호출 시 기존 OrderAck 를 반환 (멱등 — INV-06, ADR-0012).
 * 2. [MarketDataHub.latestTick] 으로 최신 시세 조회. 없으면 IllegalStateException — WS 가 아직 emit 되지 않은 상태.
 * 3. [SlippageModel] 로 체결가 산출 (BUY 는 +slippage, SELL 은 -slippage).
 * 4. (baseLatencyMs ± jitterMs) 만큼 coroutine delay 로 거래소 지연 시뮬.
 * 5. PaperAccount 잔고 조정: BUY = -notional, SELL = +notional (INV-P2-09 — ExchangeCredential 잔고와 분리).
 * 6. Execution 메모리 캐시 + `OrderFilled` 도메인 이벤트 발행.
 * 7. `paper-{orderId}` exchangeOrderId 반환.
 *
 * ## 제약
 * - `OrderCommand.strategyId` 와 `OrderCommand.symbol` 필수 — Phase 2 PAPER 모드 호출자는 항상 채워야 함.
 * - `cancelOrder` 는 no-op (즉시 체결 모델).
 * - `fetchBalance(tenantId, symbol)` 는 strategyId 컨텍스트 부재로 Phase 2 stub. 외부 호출 없음 가정.
 *
 * ## Profile
 * - `paper` 프로파일에서 활성화. `test` 프로파일에서도 등록되어 통합 테스트 활용 가능.
 *
 * ## Partial Fill (Phase 2 단순화)
 * - `partialFillProb` 환경변수 노출만 하고 본 단계에서는 항상 full fill. 실제 분할 체결은 Phase 3 검토.
 */
@Component
@Profile("paper", "test")
class PaperExchangeAdapter(
    private val hub: MarketDataHub,
    private val slippageModel: SlippageModel,
    private val accountRepo: PaperAccountRepositoryPort,
    private val eventPublisher: EventPublisher,
    private val clock: Clock,
    @Value("\${quant.paper.execution-latency.ms.default:50}")
    private val baseLatencyMs: Long = 50,
    @Value("\${quant.paper.execution-latency.ms.jitter:20}")
    private val jitterMs: Long = 20,
    @Value("\${quant.paper.partial-fill.probability:0.0}")
    private val partialFillProb: Double = 0.0
) : ExchangeAdapter {

    private val random: SecureRandom = SecureRandom()
    private val acks: ConcurrentHashMap<UUID, OrderAck> = ConcurrentHashMap()
    private val executions: ConcurrentHashMap<UUID, Execution> = ConcurrentHashMap()

    /** PAPER 모드는 거래소 무관. 도메인 enum 의 첫 값(BITHUMB) 을 default 로 노출. */
    override val exchange: Exchange = Exchange.BITHUMB

    override suspend fun placeOrder(tenantId: TenantId, command: OrderCommand): OrderAck {
        // 1. 멱등 가드 — 동일 orderId 재호출
        val existing = acks[command.orderId.value]
        if (existing != null) {
            logger.debug { "PaperExchangeAdapter.placeOrder: idempotent return orderId=${command.orderId.value}" }
            return existing
        }

        // 2. PAPER 모드 필수 컨텍스트 검증
        val strategyId = command.strategyId
            ?: error("PaperExchangeAdapter.placeOrder: strategyId required for PAPER mode (orderId=${command.orderId.value})")
        val symbolRaw = command.symbol
            ?: error("PaperExchangeAdapter.placeOrder: symbol required for PAPER mode (orderId=${command.orderId.value})")
        val symbol = Symbol(symbolRaw)

        // 3. 최신 tick 조회
        val latestTick = hub.latestTick(symbol)
            ?: throw IllegalStateException(
                "PaperExchangeAdapter.placeOrder: no latest tick for symbol=$symbol — WS not yet emitted"
            )

        // 4. 슬리피지 적용 체결가
        val executedPrice: Price = slippageModel.apply(Price(latestTick.price), command.side)

        // 5. 거래소 지연 시뮬
        val latency = computeLatencyMs()
        if (latency > 0) {
            delay(latency)
        }

        // 6. PaperAccount 잔고 조정
        val notional: BigDecimal = executedPrice.value.multiply(command.quantity.value)
        val delta: BigDecimal = when (command.side) {
            OrderSide.BUY -> notional.negate()
            OrderSide.SELL -> notional
        }
        accountRepo.adjustBalance(tenantId, strategyId, delta)

        // 7. Execution 캐시 + OrderFilled 이벤트 발행
        val acceptedAt = clock.now()
        val execution = Execution(
            price = executedPrice,
            quantity = command.quantity,
            executedAt = acceptedAt
        )
        executions[command.orderId.value] = execution

        eventPublisher.publish(
            OrderFilled(
                tenantId = tenantId,
                orderId = command.orderId,
                executedPrice = executedPrice,
                executedQty = command.quantity
            )
        )

        // 8. paper- prefix 강제
        val ack = OrderAck(
            exchangeOrderId = "paper-${command.orderId.value}",
            acceptedAt = acceptedAt
        )
        acks[command.orderId.value] = ack
        return ack
    }

    override suspend fun cancelOrder(tenantId: TenantId, exchangeOrderId: String) {
        // PAPER 즉시 체결 모델: 취소 대상 미존재.
    }

    /**
     * Phase 2 단순화: strategyId 컨텍스트 부재로 stub.
     *
     * 현재 어떤 호출처도 사용하지 않는다. PAPER 모드 잔고 조회는 [PaperAccountRepositoryPort.load] 직접 사용.
     * Phase 3 LIVE 통합 시 인터페이스 확장 또는 wrapper 도입 검토.
     */
    override suspend fun fetchBalance(tenantId: TenantId, symbol: String): BigDecimal {
        throw NotImplementedError(
            "PaperExchangeAdapter.fetchBalance: strategyId context missing — use PaperAccountRepositoryPort.load directly"
        )
    }

    override suspend fun fetchExecution(tenantId: TenantId, orderId: UUID): Execution? = executions[orderId]

    private fun computeLatencyMs(): Long {
        if (jitterMs <= 0) return baseLatencyMs.coerceAtLeast(0)
        // SecureRandom.nextLong(origin, bound) — bound exclusive.
        val offset = random.nextLong(-jitterMs, jitterMs + 1)
        return (baseLatencyMs + offset).coerceAtLeast(0)
    }
}
