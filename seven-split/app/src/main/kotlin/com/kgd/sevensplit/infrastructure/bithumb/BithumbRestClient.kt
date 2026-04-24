package com.kgd.sevensplit.infrastructure.bithumb

import kotlinx.coroutines.reactor.awaitSingle
import org.springframework.web.reactive.function.client.WebClient
import org.springframework.web.reactive.function.client.WebClientResponseException
import java.time.Duration

/**
 * TG-07.1: 빗썸 Public Candle Stick API 클라이언트.
 *
 * 엔드포인트: `GET /public/candlestick/{order_currency}_{payment_currency}/{chart_intervals}`
 *
 * 빗썸 Public API 특성:
 * - 인증 불요 (Phase 1 public 전용)
 * - 한 번 호출에 `chartIntervals` 기준 수백~수천 개 과거 캔들을 일괄 반환 (페이지네이션 없음)
 * - 분당 140 request 의 공식 rate limit → 2 symbol × 소수 interval 조합이라 여유 있음
 *
 * 호출 결과는 [BithumbCandleResponse] 로 파싱되며, 30초 timeout 초과 시 예외 발생.
 * Coroutine(suspend) API 를 사용한다 (ADR-0002).
 */
class BithumbRestClient(
    private val webClient: WebClient,
    private val timeout: Duration = Duration.ofSeconds(30),
) {
    /**
     * 지정한 심볼 / interval 의 캔들 데이터를 1회 호출로 조회.
     *
     * @param orderCurrency 주문 통화. 예: BTC, ETH
     * @param paymentCurrency 지불 통화. 기본값 KRW (Phase 1 확정)
     * @param chartIntervals 빗썸 포맷: 1m, 3m, 5m, 10m, 30m, 1h, 6h, 12h, 24h
     * @throws BithumbApiException HTTP 4xx/5xx, 타임아웃, 네트워크 오류 등 모든 실패 시
     */
    suspend fun fetchCandles(
        orderCurrency: String,
        paymentCurrency: String = "KRW",
        chartIntervals: String = "1m",
    ): BithumbCandleResponse {
        return try {
            webClient.get()
                .uri("/public/candlestick/{oc}_{pc}/{interval}", orderCurrency, paymentCurrency, chartIntervals)
                .retrieve()
                .bodyToMono(BithumbCandleResponse::class.java)
                .timeout(timeout)
                .awaitSingle()
        } catch (e: WebClientResponseException) {
            throw BithumbApiException(
                "bithumb http error status=${e.statusCode} body=${e.responseBodyAsString.take(200)}",
                e,
            )
        } catch (e: BithumbApiException) {
            throw e
        } catch (e: Exception) {
            throw BithumbApiException("bithumb fetch failed: ${e.message}", e)
        }
    }
}
