package com.kgd.ranking

import com.kgd.common.exception.BusinessException
import com.kgd.ranking.infrastructure.routes.CachedRouteLookup
import com.kgd.ranking.infrastructure.routes.GoogleRoutesClient
import com.kgd.ranking.infrastructure.routes.LatLng
import com.kgd.ranking.infrastructure.routes.RouteResult
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import java.time.Clock
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset

/** 테스트에서 날짜를 넘길 수 있는 시계. */
private class MutableClock(var instant: Instant) : Clock() {
    override fun getZone(): ZoneId = ZoneOffset.UTC
    override fun withZone(zone: ZoneId): Clock = this
    override fun instant(): Instant = instant
}

class CachedRouteLookupTest : BehaviorSpec({

    val seoul = LatLng(37.5665, 126.9780)
    val busan = LatLng(35.1796, 129.0756)
    val route = RouteResult(listOf(seoul, busan), "poly", 325_000, 14_400)

    fun lookup(client: GoogleRoutesClient, budget: Int = 3, clock: MutableClock = MutableClock(Instant.parse("2026-08-23T01:00:00Z"))) =
        CachedRouteLookup(client, budget, clock) to clock

    Given("같은 구간을 두 번 찾을 때") {
        val client = mockk<GoogleRoutesClient>()
        every { client.computeRoute(any(), any()) } returns route
        val (sut, _) = lookup(client)

        When("연달아 조회하면") {
            sut.route(seoul, busan)
            sut.route(seoul, busan)

            Then("외부는 한 번만 부른다") {
                verify(exactly = 1) { client.computeRoute(any(), any()) }
            }

            Then("캐시 적중은 예산을 쓰지 않는다") {
                sut.spent() shouldBe 1
            }
        }
    }

    Given("지도 클릭이 100m 안쪽으로 어긋났을 때") {
        val client = mockk<GoogleRoutesClient>()
        every { client.computeRoute(any(), any()) } returns route
        val (sut, _) = lookup(client)

        When("두 번 조회하면") {
            sut.route(seoul, busan)
            sut.route(LatLng(37.56653, 126.97804), LatLng(35.17962, 129.07558))

            Then("같은 구간으로 보고 외부를 다시 부르지 않는다 — 반올림이 없으면 캐시가 영원히 빈다") {
                verify(exactly = 1) { client.computeRoute(any(), any()) }
            }
        }
    }

    Given("다른 구간일 때") {
        val client = mockk<GoogleRoutesClient>()
        every { client.computeRoute(any(), any()) } returns route
        val (sut, _) = lookup(client)

        When("두 구간을 조회하면") {
            sut.route(seoul, busan)
            sut.route(seoul, LatLng(35.8714, 128.6014))

            Then("각각 부른다") {
                verify(exactly = 2) { client.computeRoute(any(), any()) }
                sut.spent() shouldBe 2
            }
        }
    }

    Given("일일 예산을 다 썼을 때") {
        val client = mockk<GoogleRoutesClient>()
        every { client.computeRoute(any(), any()) } returns route
        val (sut, _) = lookup(client, budget = 2)

        sut.route(seoul, busan)
        sut.route(seoul, LatLng(35.8714, 128.6014))

        When("새 구간을 더 찾으면") {
            Then("외부를 부르지 않고 거절한다 — 무료 한도는 상한이 아니라 통과 지점이다") {
                shouldThrow<BusinessException> { sut.route(seoul, LatLng(33.4996, 126.5312)) }
                verify(exactly = 2) { client.computeRoute(any(), any()) }
            }

            Then("이미 캐시된 구간은 예산과 무관하게 계속 나온다") {
                sut.route(seoul, busan).encodedPolyline shouldBe "poly"
            }
        }
    }

    Given("날짜가 바뀌었을 때") {
        val client = mockk<GoogleRoutesClient>()
        every { client.computeRoute(any(), any()) } returns route
        val clock = MutableClock(Instant.parse("2026-08-23T01:00:00Z"))
        val sut = CachedRouteLookup(client, 1, clock)
        sut.route(seoul, busan)
        shouldThrow<BusinessException> { sut.route(seoul, LatLng(35.8714, 128.6014)) }

        When("다음 날 다시 찾으면") {
            clock.instant = Instant.parse("2026-08-24T01:00:00Z")

            Then("예산이 초기화된다") {
                sut.route(seoul, LatLng(35.8714, 128.6014)).encodedPolyline shouldBe "poly"
                sut.spent() shouldBe 1
            }
        }
    }
})
