package com.kgd.quant.application.live

import com.kgd.quant.application.port.persistence.RiskLimitRepositoryPort
import com.kgd.quant.application.port.state.DailyMetrics
import com.kgd.quant.application.port.state.RiskMetricsPort
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.live.RiskLimit
import com.kgd.quant.domain.live.SuspendReason
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.runBlocking
import java.math.BigDecimal
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/**
 * RiskLimitServiceSpec — 사전 게이트 (PreOrderResult) + 사후 누적 (recordOrderAndCheck) (L8).
 */
class RiskLimitServiceSpec : BehaviorSpec({
    val tenantId = TenantId("22222222-2222-2222-2222-222222222222")
    val today = LocalDate.parse("2026-05-05")
    val fixedClock = Clock.fixed(today.atStartOfDay(ZoneId.of("Asia/Seoul")).toInstant(), ZoneId.of("Asia/Seoul"))
    val updatedAt = Instant.parse("2026-05-05T00:00:00Z")

    given("RiskLimitService.evaluatePreOrder") {
        val repo = mockk<RiskLimitRepositoryPort>(relaxed = true)
        val metrics = mockk<RiskMetricsPort>(relaxed = true)
        val service = RiskLimitService(repo, metrics, fixedClock)

        val limit = RiskLimit.default(tenantId, 1L, updatedAt)
        coEvery { repo.findByTenantId(tenantId) } returns limit

        `when`("singleOrderMaxKrw 초과") {
            then("Reject(DAILY_VOLUME_LIMIT)") {
                val r = runBlocking { service.evaluatePreOrder(tenantId, BigDecimal("100001")) }
                r.shouldBeInstanceOf<RiskLimitService.PreOrderResult.Reject>()
                (r as RiskLimitService.PreOrderResult.Reject).reason shouldBe SuspendReason.DAILY_VOLUME_LIMIT
            }
        }

        `when`("일일 손실 한도 도달") {
            coEvery { metrics.snapshot(tenantId, today) } returns DailyMetrics(
                lossKrw = BigDecimal("100000"),
                volumeKrw = BigDecimal.ZERO,
                orderCount = 1L,
            )
            then("Reject(DAILY_LOSS_LIMIT)") {
                val r = runBlocking { service.evaluatePreOrder(tenantId, BigDecimal("50000")) }
                r.shouldBeInstanceOf<RiskLimitService.PreOrderResult.Reject>()
                (r as RiskLimitService.PreOrderResult.Reject).reason shouldBe SuspendReason.DAILY_LOSS_LIMIT
            }
        }

        `when`("정상 주문") {
            coEvery { metrics.snapshot(tenantId, today) } returns DailyMetrics(BigDecimal.ZERO, BigDecimal.ZERO, 0L)
            then("Allow") {
                val r = runBlocking { service.evaluatePreOrder(tenantId, BigDecimal("50000")) }
                r.shouldBeInstanceOf<RiskLimitService.PreOrderResult.Allow>()
            }
        }
    }

    given("RiskLimitService.recordOrderAndCheck") {
        val repo = mockk<RiskLimitRepositoryPort>(relaxed = true)
        val metrics = mockk<RiskMetricsPort>(relaxed = true)
        val service = RiskLimitService(repo, metrics, fixedClock)

        val limit = RiskLimit.default(tenantId, 1L, updatedAt)
        coEvery { repo.findByTenantId(tenantId) } returns limit

        `when`("누적 손실이 한도 초과") {
            coEvery { metrics.snapshot(tenantId, today) } returns DailyMetrics(
                lossKrw = BigDecimal("150000"),
                volumeKrw = BigDecimal("100000"),
                orderCount = 5L,
            )
            then("DAILY_LOSS_LIMIT 반환 — 호출자가 토글") {
                val r = runBlocking {
                    service.recordOrderAndCheck(tenantId, BigDecimal("50000"), BigDecimal("-30000"))
                }
                r shouldBe SuspendReason.DAILY_LOSS_LIMIT
            }
        }
    }
})
