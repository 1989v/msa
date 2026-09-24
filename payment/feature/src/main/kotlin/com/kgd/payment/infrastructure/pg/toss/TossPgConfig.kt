package com.kgd.payment.infrastructure.pg.toss

import com.kgd.payment.application.payment.port.PgSettlementLine
import com.kgd.payment.application.payment.port.PgSettlementPort
import io.github.resilience4j.circuitbreaker.CircuitBreaker
import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpHeaders
import org.springframework.http.client.JdkClientHttpRequestFactory
import org.springframework.web.client.HttpClientErrorException
import org.springframework.web.client.RestClient
import tools.jackson.databind.ObjectMapper
import java.net.http.HttpClient
import java.time.Duration
import java.time.LocalDate
import java.util.Base64

/**
 * 토스페이먼츠 어댑터 배선 — `payment.pg=toss` 일 때만 켜진다. 기본(모의 PG)에서는 이 설정의 빈이 하나도 없다.
 *
 * 키는 `${TOSS_SECRET_KEY}` 에서만 온다(기본값 없음). toss 로 켰는데 키가 없거나 비었으면 기동하지 않는다 —
 * 약한 기본값으로 조용히 뜨는 경로를 두지 않는다.
 *
 * 운영(oci-arm)은 켜지 않는다: commerce 상시 파드에 외부 egress 가 없다(ADR-0031/0070). 켜려면 egress 예외 ADR 이 먼저다.
 */
@Configuration
@ConditionalOnProperty(prefix = "payment", name = ["pg"], havingValue = "toss")
class TossPgConfig {

    @Bean
    fun paymentTossRestClient(
        @Value("\${payment.toss.base-url:https://api.tosspayments.com}") baseUrl: String,
        @Value("\${payment.toss.secret-key}") secretKey: String,
    ): RestClient = tossRestClient(baseUrl, secretKey, CONNECT_TIMEOUT, READ_TIMEOUT)

    /** 빈 이름에 도메인 접두 — commerce 에는 order 의 CircuitBreakerRegistry 가 따로 있다 */
    @Bean
    fun paymentTossCircuitBreaker(): CircuitBreaker = circuitBreaker()

    @Bean
    fun tossPgAdapter(
        @Qualifier("paymentTossRestClient") restClient: RestClient,
        @Qualifier("paymentTossCircuitBreaker") circuitBreaker: CircuitBreaker,
        objectMapper: ObjectMapper,
    ): TossPgAdapter = TossPgAdapter(restClient, circuitBreaker, objectMapper)

    /**
     * 토스 정산 조회 API 는 아직 붙이지 않았다 — 대사 배치는 모의 PG 에서만 돈다(스케줄러가 mock 조건).
     * 이 빈은 대사 서비스가 기동할 수 있게 자리만 채우고, 불리면 실패한다(조용히 빈 파일로 대사하지 않는다).
     */
    @Bean
    fun tossSettlementUnsupported(): PgSettlementPort = object : PgSettlementPort {
        override fun settlementLines(settleDate: LocalDate): List<PgSettlementLine> =
            throw UnsupportedOperationException("토스 정산 조회는 연동 전이다 — payment.pg=toss 에서는 대사를 돌리지 않는다")
    }

    companion object {
        val CONNECT_TIMEOUT: Duration = Duration.ofSeconds(3)
        val READ_TIMEOUT: Duration = Duration.ofSeconds(5)

        /** 연결 3초 · 읽기 5초 (ADR-0015). 인증은 Basic base64("{시크릿 키}:") — 토스 v1 규약 */
        fun tossRestClient(baseUrl: String, secretKey: String, connectTimeout: Duration, readTimeout: Duration): RestClient {
            require(secretKey.isNotBlank()) { "TOSS_SECRET_KEY 가 비었습니다 — payment.pg=toss 는 키 없이 기동하지 않는다" }
            val factory = JdkClientHttpRequestFactory(HttpClient.newBuilder().connectTimeout(connectTimeout).build())
                .apply { setReadTimeout(readTimeout) }
            val basic = "Basic " + Base64.getEncoder().encodeToString("$secretKey:".toByteArray())
            return RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(factory)
                .defaultHeader(HttpHeaders.AUTHORIZATION, basic)
                .build()
        }

        /** 4xx(거절·잘못된 요청)는 PG 장애가 아니라서 열림 판정에 넣지 않는다 */
        fun circuitBreaker(): CircuitBreaker = CircuitBreaker.of(
            "paymentToss",
            CircuitBreakerConfig.custom()
                .slidingWindowType(CircuitBreakerConfig.SlidingWindowType.COUNT_BASED)
                .slidingWindowSize(10)
                .failureRateThreshold(50f)
                .waitDurationInOpenState(Duration.ofSeconds(30))
                .permittedNumberOfCallsInHalfOpenState(3)
                .ignoreExceptions(HttpClientErrorException::class.java)
                .build(),
        )
    }
}
