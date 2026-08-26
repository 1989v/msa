package com.kgd.quant.application.chart.usecase

import com.kgd.quant.application.external.port.FundamentalsPort
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.asset.Fundamentals
import com.kgd.quant.domain.market.MarketCode

/** 재무 기초 지표 조회. */
interface GetFundamentalsUseCase {
    suspend fun fundamentals(asset: AssetCode, market: MarketCode): Fundamentals?
}
