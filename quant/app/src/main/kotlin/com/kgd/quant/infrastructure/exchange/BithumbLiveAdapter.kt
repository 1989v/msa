package com.kgd.quant.infrastructure.exchange

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.quant.application.port.credential.DecryptedCredential
import com.kgd.quant.application.port.exchange.AccountBalance
import com.kgd.quant.application.port.exchange.AssetBalance
import com.kgd.quant.application.port.exchange.CancelAck
import com.kgd.quant.application.port.exchange.ExchangeException
import com.kgd.quant.application.port.exchange.LiveExchangeAdapter
import com.kgd.quant.application.port.exchange.OrderAck
import com.kgd.quant.application.port.exchange.OrderPlacement
import com.kgd.quant.application.port.exchange.OrderStatusSnapshot
import com.kgd.quant.domain.asset.Asset
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.market.Market
import com.kgd.quant.domain.order.OrderSide
import com.kgd.quant.domain.order.OrderStatus
import com.kgd.quant.domain.order.SpotOrderType
import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.JWSHeader
import com.nimbusds.jose.crypto.MACSigner
import com.nimbusds.jwt.JWTClaimsSet
import com.nimbusds.jwt.SignedJWT
import io.github.oshai.kotlinlogging.KotlinLogging
import io.github.resilience4j.kotlin.ratelimiter.executeSuspendFunction
import io.github.resilience4j.ratelimiter.RateLimiter
import io.github.resilience4j.ratelimiter.RateLimiterConfig
import io.github.resilience4j.ratelimiter.RateLimiterRegistry
import kotlinx.coroutines.reactor.awaitSingle
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.BodyInserters
import org.springframework.web.reactive.function.client.WebClient
import org.springframework.web.reactive.function.client.WebClientResponseException
import java.math.BigDecimal
import java.security.MessageDigest
import java.time.Duration
import java.time.Instant
import java.util.Date

private val log = KotlinLogging.logger {}

/**
 * BithumbLiveAdapter — Phase 3 빗썸 Private API 어댑터 (ADR-0037 / TG-P3-20).
 *
 * 인증: JWT(HS512), payload = { access_key, nonce, query_hash, query_hash_alg=SHA512 }
 * (ADR-0024 Errata — 빗썸은 JWT(HS512) 사용, 업비트와 호환).
 *
 * Read-only ticker (latestPrice/latestPriceAt/market/supports) 는 [BithumbMarketAdapter] 위임.
 *
 * Resilience4j RateLimiter: 8 req/sec (빗썸 Private order endpoint 보수적 한도).
 */
@Component
@ConditionalOnProperty(name = ["quant.bithumb.live.enabled"], havingValue = "true", matchIfMissing = false)
class BithumbLiveAdapter(
    private val readOnly: BithumbMarketAdapter,
    webClientBuilder: WebClient.Builder,
    rateLimiterRegistry: RateLimiterRegistry,
    private val objectMapper: ObjectMapper,
    @Value("\${quant.bithumb.live.base-url:https://api.bithumb.com}")
    baseUrl: String,
) : LiveExchangeAdapter {

    private val client: WebClient = webClientBuilder.baseUrl(baseUrl).build()

    private val rateLimiter: RateLimiter = rateLimiterRegistry.rateLimiter(
        "bithumb-live",
        RateLimiterConfig.custom()
            .limitRefreshPeriod(Duration.ofSeconds(1))
            .limitForPeriod(8)
            .timeoutDuration(Duration.ofMillis(500))
            .build(),
    )

    // ── MarketAdapter 위임 ────────────────────────────────────────────────────
    override val market: Market = readOnly.market
    override fun supports(asset: Asset): Boolean = readOnly.supports(asset)
    override suspend fun latestPrice(asset: Asset): BigDecimal = readOnly.latestPrice(asset)
    override suspend fun latestPriceAt(asset: Asset): Instant = readOnly.latestPriceAt(asset)

    // ── LiveExchangeAdapter ───────────────────────────────────────────────────
    override suspend fun placeOrder(credential: DecryptedCredential, order: OrderPlacement): OrderAck =
        rateLimiter.executeSuspendFunction {
            val params = mapOf(
                "order_currency" to order.assetCode.value,
                "payment_currency" to "KRW",
                "units" to order.quantity.toPlainString(),
                "type" to bithumbOrderType(order.side),
                "price" to (order.priceKrw?.toPlainString() ?: ""),
            ).filterValues { it.isNotEmpty() }
            val resp = postPrivate("/trade/place", params, credential)
            val body = parseBody(resp)
            failIfError(body)
            OrderAck(
                exchangeOrderId = body["order_id"]?.toString().orEmpty(),
                acceptedAt = Instant.now(),
            )
        }

    override suspend fun cancelOrder(
        credential: DecryptedCredential,
        exchangeOrderId: String,
        assetCode: AssetCode,
    ): CancelAck = rateLimiter.executeSuspendFunction {
        val resp = postPrivate(
            "/trade/cancel",
            mapOf(
                "order_id" to exchangeOrderId,
                "currency" to assetCode.value,
                "type" to "ask",
            ),
            credential,
        )
        val body = parseBody(resp)
        failIfError(body)
        CancelAck(exchangeOrderId, Instant.now())
    }

    override suspend fun fetchOrderStatus(
        credential: DecryptedCredential,
        exchangeOrderId: String,
        assetCode: AssetCode,
    ): OrderStatusSnapshot = rateLimiter.executeSuspendFunction {
        val resp = postPrivate(
            "/info/order_detail",
            mapOf("order_id" to exchangeOrderId, "order_currency" to assetCode.value),
            credential,
        )
        val body = parseBody(resp)
        failIfError(body)
        val data = body["data"] as? Map<*, *> ?: emptyMap<String, Any>()
        val status = mapStatus(data["status"]?.toString())
        OrderStatusSnapshot(
            exchangeOrderId = exchangeOrderId,
            status = status,
            filledQuantity = (data["units_traded"]?.toString() ?: "0").toBigDecimal(),
            remainingQuantity = (data["units_remaining"]?.toString() ?: "0").toBigDecimal(),
            avgFilledPriceKrw = (data["avg_price"]?.toString())?.toBigDecimalOrNull(),
            updatedAt = Instant.now(),
        )
    }

    override suspend fun fetchAccountBalance(credential: DecryptedCredential): AccountBalance =
        rateLimiter.executeSuspendFunction {
            val resp = postPrivate("/info/balance", mapOf("currency" to "ALL"), credential)
            val body = parseBody(resp)
            failIfError(body)
            val data = body["data"] as? Map<*, *> ?: emptyMap<String, Any>()
            val map = mutableMapOf<AssetCode, AssetBalance>()
            data.entries.forEach { (k, v) ->
                val keyStr = k?.toString() ?: return@forEach
                if (!keyStr.startsWith("available_")) return@forEach
                val assetCode = AssetCode(keyStr.removePrefix("available_").uppercase())
                val available = (v?.toString() ?: "0").toBigDecimalOrNull() ?: BigDecimal.ZERO
                val locked = (data["in_use_${assetCode.value.lowercase()}"]?.toString() ?: "0")
                    .toBigDecimalOrNull() ?: BigDecimal.ZERO
                map[assetCode] = AssetBalance(available, locked)
            }
            AccountBalance(map, Instant.now())
        }

    // ── 내부 ─────────────────────────────────────────────────────────────────
    private suspend fun postPrivate(
        endpoint: String,
        params: Map<String, String>,
        credential: DecryptedCredential,
    ): String {
        val queryString = params.entries.joinToString("&") { "${it.key}=${it.value}" } + "&endpoint=$endpoint"
        val token = buildJwt(credential, queryString)
        return try {
            client.post()
                .uri(endpoint)
                .header("Api-Key", credential.apiKey)
                .header("Api-Sign", token)
                .header("Api-Nonce", System.currentTimeMillis().toString())
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(BodyInserters.fromValue(queryString))
                .retrieve()
                .bodyToMono(String::class.java)
                .awaitSingle()
        } catch (ex: WebClientResponseException) {
            when (ex.statusCode.value()) {
                401, 403 -> throw ExchangeException.InvalidCredential("bithumb auth: ${ex.statusText}")
                429 -> throw ExchangeException.RateLimited("bithumb rate-limited")
                in 500..599 -> throw ExchangeException.TransientNetwork("bithumb 5xx", ex)
                else -> throw ExchangeException.RejectedByExchange(ex.statusCode.value().toString(), ex.message ?: "")
            }
        }
    }

    /** ADR-0024 Errata — 빗썸 JWT(HS512) 페이로드. query_hash 는 SHA512 hex. */
    private fun buildJwt(credential: DecryptedCredential, queryString: String): String {
        val nonce = System.currentTimeMillis().toString()
        val queryHash = MessageDigest.getInstance("SHA-512").digest(queryString.toByteArray())
            .joinToString("") { "%02x".format(it) }
        val claims = JWTClaimsSet.Builder()
            .claim("access_key", credential.apiKey)
            .claim("nonce", nonce)
            .claim("query_hash", queryHash)
            .claim("query_hash_alg", "SHA512")
            .issueTime(Date())
            .build()
        val header = JWSHeader.Builder(JWSAlgorithm.HS512).build()
        val signedJwt = SignedJWT(header, claims)
        signedJwt.sign(MACSigner(credential.apiSecret.toByteArray()))
        return "Bearer ${signedJwt.serialize()}"
    }

    private fun parseBody(raw: String): Map<*, *> = objectMapper.readValue(raw, Map::class.java)

    private fun failIfError(body: Map<*, *>) {
        val status = body["status"]?.toString()
        if (status == "0000") return
        val msg = body["message"]?.toString() ?: "bithumb error"
        when (status) {
            "5500" -> throw ExchangeException.InsufficientBalance(msg)
            "5600" -> throw ExchangeException.InvalidCredential(msg)
            else -> throw ExchangeException.RejectedByExchange(status ?: "unknown", msg)
        }
    }

    private fun bithumbOrderType(side: OrderSide): String = when (side) {
        OrderSide.BUY -> "bid"
        OrderSide.SELL -> "ask"
    }

    private fun mapStatus(raw: String?): OrderStatus = when (raw) {
        "체결완료" -> OrderStatus.FILLED
        "거래취소" -> OrderStatus.CANCELLED
        "거래체결중" -> OrderStatus.PARTIALLY_FILLED
        "거래대기" -> OrderStatus.SUBMITTED
        else -> OrderStatus.SUBMITTED
    }

    @Suppress("UNUSED_PARAMETER")
    private fun unused(t: SpotOrderType) {} // keep import
}
