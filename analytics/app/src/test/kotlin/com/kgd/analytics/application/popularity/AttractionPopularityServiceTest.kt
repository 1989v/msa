package com.kgd.analytics.application.popularity

import com.kgd.analytics.application.popularity.port.AttractionPopularityPort
import com.kgd.analytics.application.popularity.service.AttractionPopularityService
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.shouldBe
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

class AttractionPopularityServiceTest : BehaviorSpec({

    val port = mockk<AttractionPopularityPort>()
    // UTC 로는 9월 30일 15:30, KST 로는 10월 1일 00:30 — 날짜가 갈리는 시각
    val clock = Clock.fixed(Instant.parse("2026-09-30T15:30:00Z"), ZoneOffset.UTC)
    val service = AttractionPopularityService(port, clock)

    beforeContainer {
        clearMocks(port)
        every { port.aggregateInto(any()) } answers { firstArg<LocalDate>().dayOfMonth }
    }

    given("최근 14일을 다시 접으면") {
        val result = service.reaggregateRecent(14)

        then("KST 어제부터 거꾸로 14일을 접는다 — 오늘(KST)은 끝나지 않아 빠진다") {
            result.keys.toList() shouldContainExactly (1L..14L).map { LocalDate.of(2026, 10, 1).minusDays(it) }
            verify(exactly = 0) { port.aggregateInto(LocalDate.of(2026, 10, 1)) }
            result[LocalDate.of(2026, 9, 30)] shouldBe 30
        }
    }

    given("범위를 벗어난 일수") {
        then("0일과 원장 보존기간(90일)을 넘는 값은 거부한다") {
            shouldThrow<IllegalArgumentException> { service.reaggregateRecent(0) }
            shouldThrow<IllegalArgumentException> { service.reaggregateRecent(91) }
            verify(exactly = 0) { port.aggregateInto(any()) }
        }
    }

    given("매일 도는 집계") {
        service.aggregateYesterday()

        then("KST 어제를 접는다") {
            verify(exactly = 1) { port.aggregateInto(LocalDate.of(2026, 9, 30)) }
        }
    }
})
