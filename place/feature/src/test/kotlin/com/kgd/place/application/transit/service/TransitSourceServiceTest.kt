package com.kgd.place.application.transit.service

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.place.application.transit.port.TransitSourceRepositoryPort
import com.kgd.place.domain.transit.model.BusCoverage
import com.kgd.place.domain.transit.model.TransitBusStop
import com.kgd.place.domain.transit.model.TransitSource
import com.kgd.place.domain.transit.model.TransitSourceRun
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import java.time.LocalDate
import java.time.LocalDateTime

class TransitSourceServiceTest : BehaviorSpec({
    val repository = mockk<TransitSourceRepositoryPort>(relaxed = true)
    val service = TransitSourceService(repository)
    val old = TransitSourceRun(TransitSource.BUS, "20261005000000", 227_065, LocalDateTime.of(2026, 10, 5, 0, 5))
    val coverage = listOf(BusCoverage("11110", 12_000, true), BusCoverage("51150", 20, false))

    // 운영 표본(2026-10-11) 안동 길안정류장
    fun stop(no: String) = TransitBusStop(
        "37040:$no", no, "길안정류장", "36.458658", "128.891228", "2025-10-31", "540001", "37040", "경상북도 안동시", "안동BIS",
        36.458658, 128.891228, true, LocalDate.of(2025, 10, 31),
    )

    fun invalid(block: () -> Unit) = shouldThrow<BusinessException>(block).errorCode shouldBe ErrorCode.INVALID_INPUT

    beforeTest {
        clearMocks(repository)
        every { repository.findActiveRun(TransitSource.BUS) } returns old
    }

    Given("새 회차를 활성화할 때") {
        Then("쌓인 행 수가 보낸 수와 같으면 회차를 바꾸고 연계 판정을 통째로 바꾼다") {
            every { repository.countRows(TransitSource.BUS, "20261012000000") } returns 227_100
            every { repository.activate(TransitSource.BUS, "20261012000000", 227_100, any()) } returns 227_065
            service.activate(TransitSource.BUS, "20261012000000", 227_100, coverage).removed shouldBe 227_065
            verify { repository.replaceCoverage(coverage, any()) }
        }
        Then("묶음이 빠져 행 수가 모자라거나 0행이면 400 이고 이전 회차가 그대로다") {
            every { repository.countRows(TransitSource.BUS, "20261012000000") } returns 4_000
            invalid { service.activate(TransitSource.BUS, "20261012000000", 6_000, coverage) }
            every { repository.countRows(TransitSource.BUS, "20261012000001") } returns 0
            invalid { service.activate(TransitSource.BUS, "20261012000001", 0, coverage) }
            verify(exactly = 0) { repository.activate(any(), any(), any(), any()) }
            verify(exactly = 0) { repository.replaceCoverage(any(), any()) }
        }
        Then("버스에 연계 판정이 없거나 철도에 연계 판정이 오면 400") {
            invalid { service.activate(TransitSource.BUS, "20261012000000", 1, null) }
            invalid { service.activate(TransitSource.RAIL, "20261012000000", 1, coverage) }
        }
    }

    Given("묶음을 쌓을 때") {
        Then("활성 회차에 쓰려 하거나 회차 id 가 이상하거나 한 묶음에 같은 자연 키가 두 번이면 400") {
            invalid { service.putBus("20261005000000", listOf(stop("ADB354000001"))) }
            invalid { service.putBus("../x", listOf(stop("ADB354000001"))) }
            invalid { service.putBus("20261012000000", listOf(stop("ADB354000001"), stop("ADB354000001"))) }
            verify(exactly = 0) { repository.putBus(any(), any(), any()) }
        }
        Then("새 회차에는 쌓는다") {
            every { repository.putBus("20261012000000", any(), any()) } returns 2
            service.putBus("20261012000000", listOf(stop("ADB354000001"), stop("ADB354000002"))) shouldBe 2
        }
    }
})
