package com.kgd.quant.application.port.exchange

import com.kgd.quant.application.port.credential.DecryptedCredential
import com.kgd.quant.application.port.market.MarketAdapter
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.market.MarketCode
import com.kgd.quant.domain.order.OrderSide
import com.kgd.quant.domain.order.OrderStatus
import com.kgd.quant.domain.order.SpotOrderType
import java.math.BigDecimal
import java.time.Instant

/**
 * LiveExchangeAdapter — Phase 3 실거래소 주문 contract (ADR-0037 / TG-P3-19).
 *
 * Phase 1/2 의 [MarketAdapter] 가 read-only 시세 인터페이스라면, 본 인터페이스는 실제 주문 내기 +
 * 체결 조회 + 잔고 조회까지 포함. 인증 정보는 단명 wrapper [DecryptedCredential] 로 매 호출 주입.
 *
 * 모든 거래소(빗썸/업비트/Bybit/OKX) 어댑터가 본 인터페이스 구현. 어댑터별 차이:
 * - 서명 알고리즘 (JWT vs HMAC vs HMAC+Passphrase)
 * - RPS 한도 (Resilience4j RateLimiter)
 * - 응답 schema (DTO mapper)
 *
 * 본 인터페이스는 정상 동작만 정의. 한도 초과 / reject 등은 [ExchangeException] 의 sealed 자식으로
 * 포장되어 throw — UseCase 가 7-stage 게이트와 함께 처리.
 */
interface LiveExchangeAdapter : MarketAdapter {

    suspend fun placeOrder(credential: DecryptedCredential, order: OrderPlacement): OrderAck

    suspend fun cancelOrder(
        credential: DecryptedCredential,
        exchangeOrderId: String,
        assetCode: AssetCode,
    ): CancelAck

    suspend fun fetchOrderStatus(
        credential: DecryptedCredential,
        exchangeOrderId: String,
        assetCode: AssetCode,
    ): OrderStatusSnapshot

    suspend fun fetchAccountBalance(credential: DecryptedCredential): AccountBalance
}

/** 주문 placement 요청. */
data class OrderPlacement(
    val marketCode: MarketCode,
    val assetCode: AssetCode,
    val side: OrderSide,
    val type: SpotOrderType,
    val priceKrw: BigDecimal?,    // limit 주문 시 필수, market 주문 시 null
    val quantity: BigDecimal,
)

/** placeOrder 성공 응답. */
data class OrderAck(
    val exchangeOrderId: String,
    val acceptedAt: Instant,
)

/** cancelOrder 성공 응답. */
data class CancelAck(
    val exchangeOrderId: String,
    val cancelledAt: Instant,
)

/** fetchOrderStatus 응답 — 거래소가 알고 있는 주문의 현재 상태. */
data class OrderStatusSnapshot(
    val exchangeOrderId: String,
    val status: OrderStatus,
    val filledQuantity: BigDecimal,
    val remainingQuantity: BigDecimal,
    val avgFilledPriceKrw: BigDecimal?,
    val updatedAt: Instant,
) {
    val isFinal: Boolean = status in FINAL_STATUSES

    companion object {
        val FINAL_STATUSES = setOf(OrderStatus.FILLED, OrderStatus.CANCELLED, OrderStatus.REJECTED)
    }
}

/** fetchAccountBalance 응답 — 자산별 잔고. */
data class AccountBalance(
    val balances: Map<AssetCode, AssetBalance>,
    val fetchedAt: Instant,
)

data class AssetBalance(
    val available: BigDecimal,    // 즉시 주문 가능
    val locked: BigDecimal,       // 미체결 주문에 묶임
)

/** 거래소 호출 시 발생할 수 있는 에러 sealed. */
sealed class ExchangeException(message: String, cause: Throwable? = null) : RuntimeException(message, cause) {
    class RejectedByExchange(val code: String, message: String) : ExchangeException(message)
    class RateLimited(message: String) : ExchangeException(message)
    class InsufficientBalance(message: String) : ExchangeException(message)
    class InvalidCredential(message: String) : ExchangeException(message)
    class TransientNetwork(message: String, cause: Throwable?) : ExchangeException(message, cause)
}
