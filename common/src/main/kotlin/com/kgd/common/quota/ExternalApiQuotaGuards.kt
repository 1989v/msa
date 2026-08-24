package com.kgd.common.quota

import org.springframework.http.HttpRequest
import org.springframework.http.client.ClientHttpRequestExecution
import org.springframework.http.client.ClientHttpRequestInterceptor
import org.springframework.http.client.ClientHttpResponse
import org.springframework.web.reactive.function.client.ExchangeFilterFunction
import reactor.core.publisher.Mono

/**
 * 쿼터 게이트를 **호출 계층에** 붙이는 장치들 (ADR-0082 §4).
 *
 * 호출부가 기억해서 부르는 방식(`if (quota.tryAcquire()) client.call()`)은 컨벤션이지 강제가
 * 아니다. 호출부가 늘면 누군가 빠뜨리고, 빠뜨려도 쿼터를 넘긴 날까지 아무 일도 안 일어난다.
 */
object ExternalApiQuotaGuards {

    /**
     * 논블로킹(`WebClient`) 용.
     *
     * **AOP 를 쓰지 않는 이유**: `@Around` 는 메서드 호출 시점에 도는데 리액티브 메서드는 그때
     * `Mono`(콜드 퍼블리셔)를 **조립만** 하고 실제 요청은 `subscribe()` 에서 나간다. 그래서
     * `.retry(2)` 로 재구독하면 실제 3회인데 advice 는 1회만 센다 — **과소 계상**이라 쿼터를
     * 넘긴 줄 모르고 계속 때린다. 필터는 exchange 마다 돌아 재시도도 각각 센다.
     */
    fun filter(provider: ExternalApiProvider, ledger: ExternalApiQuotaLedger, cost: Long = 1) =
        ExchangeFilterFunction { request, next ->
            if (ledger.tryAcquire(provider, cost)) {
                next.exchange(request)
            } else {
                Mono.error(ExternalApiQuotaExceededException(provider))
            }
        }

    /** 블로킹(`RestClient` / `RestTemplate`) 용 — 실제 요청 직전에 돈다. */
    fun interceptor(provider: ExternalApiProvider, ledger: ExternalApiQuotaLedger, cost: Long = 1) =
        ClientHttpRequestInterceptor { request: HttpRequest, body: ByteArray, execution: ClientHttpRequestExecution ->
            if (!ledger.tryAcquire(provider, cost)) throw ExternalApiQuotaExceededException(provider)
            execution.execute(request, body) as ClientHttpResponse
        }
}
