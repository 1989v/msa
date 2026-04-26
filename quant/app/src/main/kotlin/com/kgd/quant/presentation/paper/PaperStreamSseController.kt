package com.kgd.quant.presentation.paper

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.quant.application.market.MarketDataHub
import com.kgd.quant.application.port.marketdata.Symbol
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.presentation.resolver.TenantHeader
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.launch
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter

private val log = KotlinLogging.logger {}

/**
 * PaperStreamSseController — TG-P2-13 SSE Paper trading 실시간 스트림.
 *
 * ## 엔드포인트
 * - `GET /api/v1/strategies/{strategyId}/paper/sse` → `text/event-stream`
 * - 이벤트 타입: `tick` (Phase 2 우선 구현). `slot`/`order` 는 후속.
 *
 * ## 인증 (단순화)
 * spec.md §12.2 first-message JWT 패턴은 후속 wire-up 예정. 본 구현은 query param
 * `authToken` 의 빈 값 여부만 검증한다 (Gateway 가 X-User-Id 를 신뢰값으로 주입하므로
 * 멀티테넌트 격리는 [TenantHeader] 로 보장된다).
 *
 * ## 데이터 소스
 * [MarketDataHub.asFlow] 를 구독하여 [Symbol] 필터를 적용. `null` 이면 전체 tick 송신.
 *
 * ## hot-path 보호
 * - SSE 송신 실패 시 emitter 종료 + collector coroutine cancel — slow consumer 가
 *   producer 를 차단하지 않도록 한다.
 * - `MarketDataHub` 자체가 `DROP_OLDEST` 정책을 갖고 있어 producer 측 안전망은 이중 적용.
 *
 * ## 트랜잭션 (ADR-0020)
 * SSE 컨트롤러는 long-lived stream 이며 `@Transactional` 을 붙이면 안 된다.
 *
 * ## ApiResponse 래퍼
 * SSE 컨트롤러는 `text/event-stream` 응답이므로 `ApiResponse<T>` 래핑에서 제외 (REST 컨트롤러 한정).
 */
@RestController
@RequestMapping("/api/v1/strategies")
class PaperStreamSseController(
    private val hub: MarketDataHub,
    private val objectMapper: ObjectMapper,
) {
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    @GetMapping("/{strategyId}/paper/sse", produces = ["text/event-stream"])
    fun stream(
        @TenantHeader tenantId: TenantId,
        @PathVariable strategyId: String,
        @RequestParam(required = false) symbol: String?,
        @RequestParam(required = false, name = "authToken") authToken: String?,
    ): SseEmitter {
        // 단순화: authToken query param 검증 (실 JWT 검증은 Phase 3 wire-up 예정)
        if (authToken.isNullOrBlank()) {
            val rejected = SseEmitter(REJECTED_TIMEOUT_MS)
            rejected.complete()
            log.warn { "SSE rejected: missing authToken tenantId=$tenantId strategyId=$strategyId" }
            return rejected
        }

        val emitter = SseEmitter(LONG_LIVED_TIMEOUT)
        val targetSymbol = symbol?.let { Symbol(it) }

        val job: Job = scope.launch {
            try {
                hub.asFlow()
                    .filter { tick -> targetSymbol == null || tick.symbol == targetSymbol }
                    .collect { tick ->
                        try {
                            val payload = mapOf(
                                "symbol" to tick.symbol.value,
                                "price" to tick.price.toPlainString(),
                                "volume" to tick.volume.toPlainString(),
                                "ts" to tick.timestamp.toString(),
                                "source" to tick.source.name,
                            )
                            emitter.send(
                                SseEmitter.event()
                                    .name(EVENT_TICK)
                                    .data(objectMapper.writeValueAsString(payload))
                            )
                        } catch (ce: CancellationException) {
                            throw ce
                        } catch (e: Exception) {
                            log.warn { "SSE send failed, completing emitter tenantId=$tenantId: ${e.message}" }
                            emitter.completeWithError(e)
                            // collect 람다에서 정상 종료 신호 — CancellationException 으로 collector 빠져나간 뒤
                            // 바깥 try/catch 에서 ce 를 재throw 하여 launch coroutine 정리.
                            throw CancellationException("SSE send failed")
                        }
                    }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                log.error(e) { "SSE collector error tenantId=$tenantId strategyId=$strategyId" }
                emitter.completeWithError(e)
            }
        }

        emitter.onCompletion {
            job.cancel(CancellationException("SSE emitter completed"))
            log.info { "SSE completed tenantId=$tenantId strategyId=$strategyId" }
        }
        emitter.onTimeout {
            job.cancel(CancellationException("SSE emitter timeout"))
            emitter.complete()
        }
        emitter.onError { err ->
            job.cancel(CancellationException("SSE emitter error"))
            log.warn { "SSE emitter error tenantId=$tenantId strategyId=$strategyId: ${err.message}" }
        }

        return emitter
    }

    companion object {
        /** Long-lived SSE — Spring SseEmitter 의 무한 대기 표현. */
        const val LONG_LIVED_TIMEOUT: Long = Long.MAX_VALUE

        /** 인증 실패 emitter 의 즉시 종료 timeout. */
        const val REJECTED_TIMEOUT_MS: Long = 0L

        /** SSE event name — tick. */
        const val EVENT_TICK: String = "tick"
    }
}
