package com.kgd.quant.application.discover.usecase

import com.github.benmanes.caffeine.cache.Cache
import com.github.benmanes.caffeine.cache.Caffeine
import com.kgd.quant.application.discover.GlobalIndexQuote
import io.github.oshai.kotlinlogging.KotlinLogging
import java.math.BigDecimal
import java.math.MathContext
import java.math.RoundingMode
import java.time.Duration
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.reactor.awaitSingle
import tools.jackson.databind.ObjectMapper

/** 글로벌 지수 스냅샷. */
interface GetGlobalIndicesUseCase {
    suspend fun fetchAll(): List<GlobalIndexQuote>
    suspend fun usdKrwRate(): java.math.BigDecimal?
}
