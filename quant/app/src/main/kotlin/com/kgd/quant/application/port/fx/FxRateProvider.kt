package com.kgd.quant.application.port.fx

import java.math.BigDecimal
import java.time.Instant

/**
 * FxRateProvider — KRW/USD 환율 추상화 (ADR-0033 Q4).
 *
 * Phase 1 구현은 [com.kgd.quant.infrastructure.fx.BithumbUsdtKrwProxy] —
 * 빗썸 USDT_KRW ticker 를 환율 proxy 로 사용 (별도 인증/API 키 0).
 *
 * Phase 2+ 는 한국은행 ECOS 또는 Open Exchange Rates 어댑터 추가 ADR.
 *
 * 1분 단위 캐시는 구현체 책임.
 */
interface FxRateProvider {
    /**
     * 지정 시각의 KRW/USD 환율. 기본은 현재 시각.
     * @return KRW per 1 USD (예: 1370.50)
     */
    suspend fun krwPerUsd(at: Instant = Instant.now()): BigDecimal
}
