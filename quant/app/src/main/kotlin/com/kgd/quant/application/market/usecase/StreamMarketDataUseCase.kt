package com.kgd.quant.application.market.usecase

import com.kgd.quant.application.marketdata.port.Symbol
import com.kgd.quant.application.marketdata.port.Tick
import com.kgd.quant.application.metrics.port.QuantMetricsPort
import io.github.oshai.kotlinlogging.KotlinLogging
import java.util.concurrent.ConcurrentHashMap
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow

/** 실시간 시세 허브 — SSE 구독 대상. */
interface StreamMarketDataUseCase {
    fun asFlow(): SharedFlow<Tick>
    fun latestTick(symbol: Symbol): Tick?
    fun emit(tick: Tick): Boolean
    fun subscriberCount(): Int
}
