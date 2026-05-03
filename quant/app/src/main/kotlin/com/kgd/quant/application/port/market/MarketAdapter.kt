package com.kgd.quant.application.port.market

import com.kgd.quant.domain.asset.Asset
import com.kgd.quant.domain.market.Market
import java.math.BigDecimal
import java.time.Instant

/**
 * MarketAdapter — 자산 클래스 무관 거래소/데이터 소스 어댑터 (ADR-0033).
 *
 * 기존 `ExchangeAdapter` 의 일반화. 암호화폐 거래소(Bithumb/Upbit) 와 주식 데이터 소스
 * (Yahoo/FDR) 가 동일 인터페이스로 캡슐화된다.
 *
 * Phase 1 은 read-only contract 만 노출 (시세 조회). 주문 contract 는 Phase 3 실매매.
 */
interface MarketAdapter {
    val market: Market

    /** 본 어댑터가 [asset] 을 지원하는지 (asset_class + 거래쌍 검증). */
    fun supports(asset: Asset): Boolean

    /** 최신 ticker 가격. 실시간성은 구현체별 (REST polling vs WebSocket). */
    suspend fun latestPrice(asset: Asset): BigDecimal

    /** 최신 ticker 시각 (timezone-naive UTC). */
    suspend fun latestPriceAt(asset: Asset): Instant
}
