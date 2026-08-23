package com.kgd.ranking

import com.kgd.common.exception.BusinessException
import com.kgd.ranking.application.dto.PointRequest
import com.kgd.ranking.application.dto.RouteGasSearchRequest
import com.kgd.ranking.application.service.RouteGasSearchService
import com.kgd.ranking.infrastructure.persistence.entity.GasStationJpaEntity
import com.kgd.ranking.infrastructure.persistence.entity.GasStationPriceJpaEntity
import com.kgd.ranking.infrastructure.persistence.repository.GasStationJpaRepository
import com.kgd.ranking.infrastructure.persistence.repository.GasStationPriceJpaRepository
import com.kgd.ranking.infrastructure.routes.GoogleRoutesClient
import com.kgd.ranking.infrastructure.routes.LatLng
import com.kgd.ranking.infrastructure.routes.RouteResult
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.ints.shouldBeGreaterThan
import io.kotest.matchers.ints.shouldBeLessThan
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import java.math.BigDecimal
import java.time.Instant

class RouteGasSearchServiceTest : BehaviorSpec({

    val routesClient = mockk<GoogleRoutesClient>()
    val stationRepository = mockk<GasStationJpaRepository>()
    val priceRepository = mockk<GasStationPriceJpaRepository>()
    val service = RouteGasSearchService(routesClient, stationRepository, priceRepository)

    // 서쪽 → 동쪽 8.8km 직선, 880초 → 평균 10 m/s
    val path = (0..100).map { LatLng(37.5, 127.0 + it * 0.001) }
    val route = RouteResult(path = path, encodedPolyline = "abc", distanceMeters = 8800, durationSeconds = 880)

    var nextId = 1L
    fun station(lat: Double, lng: Double, self: Boolean = true, brand: String = "SKE") =
        GasStationJpaEntity(
            id = nextId++,
            opinetId = "A${nextId}",
            name = "주유소${nextId}",
            brandCode = brand,
            brandName = brand,
            isSelf = self,
            latitude = BigDecimal.valueOf(lat),
            longitude = BigDecimal.valueOf(lng),
            syncedAt = Instant.EPOCH,
        )

    fun price(stationId: Long, value: Int) =
        GasStationPriceJpaEntity(stationId = stationId, productCode = "B027", price = value, updatedAt = Instant.EPOCH)

    fun request(detourLimitMin: Int = 5, selfOnly: Boolean = false, brands: List<String> = emptyList()) =
        RouteGasSearchRequest(
            origin = PointRequest(37.5, 127.0),
            destination = PointRequest(37.5, 127.1),
            detourLimitMin = detourLimitMin,
            selfOnly = selfOnly,
            brands = brands,
        )

    every { routesClient.computeRoute(any(), any()) } returns route

    Given("경로 위·근처·멀리에 주유소가 있을 때") {
        val onRoute = station(37.5, 127.05)          // 경로 위
        val near = station(37.509, 127.05)           // 약 1km 북쪽
        val far = station(37.545, 127.05)            // 약 5km 북쪽
        every { stationRepository.findWithinBox(any(), any(), any(), any()) } returns listOf(onRoute, near, far)
        every { priceRepository.findByStationIdInAndProductCode(any(), "B027") } returns listOf(
            price(onRoute.id!!, 1700), price(near.id!!, 1550), price(far.id!!, 1400),
        )

        When("5분 이탈 허용으로 찾으면") {
            val result = service.search(request(detourLimitMin = 5))

            Then("허용 범위를 넘는 곳은 값이 싸도 빠진다") {
                result.candidates.map { it.opinetId } shouldContainExactly
                    listOf(near.opinetId, onRoute.opinetId)
            }

            Then("싼 순서로 나온다") {
                result.candidates.first().price shouldBe 1550
            }

            Then("이탈 시간은 왕복 근사다 — 1km 옆은 10m/s 기준 약 3분") {
                val nearCandidate = result.candidates.first { it.opinetId == near.opinetId }
                nearCandidate.detourMinutes shouldBeGreaterThan 2
                nearCandidate.detourMinutes shouldBeLessThan 5
            }

            Then("경로 위 주유소의 이탈 시간은 0분이다") {
                result.candidates.first { it.opinetId == onRoute.opinetId }.detourMinutes shouldBe 0
            }

            Then("절약액은 후보 평균가 기준이다") {
                result.averagePrice shouldBe 1625
                result.candidates.first { it.opinetId == near.opinetId }.savingsPerLiter shouldBe 75
            }

            Then("출처 표기가 실린다") {
                result.sourceLabel shouldBe "한국석유공사 오피넷"
            }
        }

        When("이탈 허용이 0분이면") {
            val result = service.search(request(detourLimitMin = 0))

            Then("경로에 바로 붙은 곳(도로변)만 남는다 — 0분이 '아무것도 없음'이 되면 안 된다") {
                result.candidates.map { it.opinetId } shouldContainExactly listOf(onRoute.opinetId)
            }
        }
    }

    Given("셀프가 아닌 주유소가 섞여 있을 때") {
        val self = station(37.5, 127.03, self = true)
        val full = station(37.5, 127.06, self = false)
        every { stationRepository.findWithinBox(any(), any(), any(), any()) } returns listOf(self, full)
        every { priceRepository.findByStationIdInAndProductCode(any(), "B027") } returns listOf(
            price(self.id!!, 1700), price(full.id!!, 1500),
        )

        When("셀프만 조건으로 찾으면") {
            val result = service.search(request(selfOnly = true))

            Then("더 싸도 셀프가 아니면 빠진다") {
                result.candidates.map { it.opinetId } shouldContainExactly listOf(self.opinetId)
            }
        }

        When("브랜드를 지정하면") {
            val result = service.search(request(brands = listOf("GSC")))

            Then("해당 브랜드가 없으면 빈 결과가 정상 응답이다") {
                result.candidates shouldBe emptyList()
                result.averagePrice shouldBe null
                result.encodedPolyline shouldBe "abc"
            }
        }
    }

    Given("해당 유종 가격이 없는 주유소뿐일 때") {
        val onRoute = station(37.5, 127.05)
        every { stationRepository.findWithinBox(any(), any(), any(), any()) } returns listOf(onRoute)
        every { priceRepository.findByStationIdInAndProductCode(any(), "B027") } returns emptyList()

        When("찾으면") {
            val result = service.search(request())

            Then("빈 결과이되 경로 정보는 그대로 온다") {
                result.candidates shouldBe emptyList()
                result.distanceMeters shouldBe 8800
                result.durationMinutes shouldBe 15
            }
        }
    }

    Given("출발지와 도착지가 같을 때") {
        every { routesClient.computeRoute(any(), any()) } returns
            RouteResult(listOf(LatLng(37.5, 127.0)), "a", 0, 0)
        every { stationRepository.findWithinBox(any(), any(), any(), any()) } returns emptyList()
        every { priceRepository.findByStationIdInAndProductCode(any(), "B027") } returns emptyList()

        When("찾으면") {
            Then("터지지 않고 빈 결과를 준다") {
                service.search(request()).candidates shouldBe emptyList()
            }
        }
    }

    Given("잘못된 입력일 때") {
        Then("이탈 허용 시간과 결과 개수는 범위를 벗어날 수 없다") {
            shouldThrow<BusinessException> { service.search(request(detourLimitMin = -1)) }
            shouldThrow<BusinessException> { service.search(request(detourLimitMin = 999)) }
            shouldThrow<BusinessException> {
                service.search(request().copy(limit = 0))
            }
        }
    }
})
