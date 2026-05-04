package com.kgd.quant.application.port.persistence

import com.kgd.quant.application.kimchi.KimchiPremium
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.market.MarketCode
import java.time.Instant

/**
 * KimchiPremiumTickRepositoryPort — `quant.kimchi_premium_tick` ClickHouse 테이블 read-only port.
 *
 * Phase 2 H3 (G2 후속) — RunSignalBacktestUseCase.evaluateKimchiPremium 가 placeholder 에서
 * 정통 시계열 read 로 전환되는 단계의 인터페이스. 적재 path 는 별도 ingest job (TG-P2 후속).
 */
interface KimchiPremiumTickRepositoryPort {

    /**
     * 지정 구간의 김치프리미엄 시계열을 ts ASC 로 반환.
     *
     * 빈 결과는 적재 부재 (또는 query 오류 시 fallback) — 호출자 전략은 백테스트 단계라면
     * "트리거 없음" 으로 해석한다.
     */
    suspend fun query(
        assetCode: AssetCode,
        krMarketCode: MarketCode,
        foreignMarketCode: MarketCode,
        from: Instant,
        to: Instant,
    ): List<KimchiPremium>
}
