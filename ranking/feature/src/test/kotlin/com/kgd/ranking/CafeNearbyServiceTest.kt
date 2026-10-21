package com.kgd.ranking

import com.kgd.ranking.application.cafe.dto.*
import com.kgd.ranking.application.cafe.port.*
import com.kgd.ranking.application.cafe.service.CafeNearbyService
import com.kgd.ranking.application.cafe.usecase.*
import com.kgd.ranking.domain.cafe.model.CaffeineStatus
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.assertions.throwables.shouldThrow
import io.mockk.*
import java.time.Instant
import java.time.LocalDate
import java.math.BigDecimal

class CafeNearbyServiceTest : BehaviorSpec({
    val port = mockk<CafeStoreRepositoryPort>()
    val drinks = mockk<CafeDrinkRepositoryPort>()
    val province = CafeArea("1100000000", "서울", "PROVINCE", null, 37.5, 127.0, "https://www.data.go.kr/reference")
    val area = province.copy(code = "1168000000", name = "강남구", level = "DISTRICT", parentCode = province.code)
    val meta = CafeSnapshotMeta("v1", LocalDate.now(), Instant.now(), Instant.now(), "v1")
    val store = CafeStoreRecord("public-store", "starbucks", "스타벅스", "스타벅스", "강남점", "서울 강남구", 37.5001, 127.0001, area.code, "CONFIRMED", mapOf("unknown" to "raw"))
    val row = CafeDrinkResponse.of(cafeItem("starbucks", "라떼").toDomain())
    beforeTest {
        clearMocks(port, drinks)
        every { port.metadata() } returns meta
        every { port.areas(null) } returns listOf(province)
        every { port.area(area.code) } returns area
        every { port.candidates(any(), any(), any(), any(), any()) } returns listOf(store)
        every { drinks.search(any()) } returns CafeDrinkPage(listOf(row), 1, 0, 200)
        every { drinks.variants(any()) } returns listOf(row)
    }
    Given("validated complete local projection") {
        val service = CafeNearbyService(port, drinks, true)
        Then("location is redacted, result includes only public store coordinates and one variant is explicit auto selection") {
            val location = CafeLocation("CURRENT", 37.5, 127.0)
            location.toString() shouldBe "CafeLocation(redacted)"
            val request = CafeNearbyRequest(location, group = "라떼")
            request.toString() shouldBe "CafeNearbyRequest(redacted)"
            val result = service.search(request)
            result.storeSourceAsOf shouldBe meta.sourceAsOf
            service.capability().sourceAsOf shouldBe meta.sourceAsOf
            result.items.single().sourceAsOf shouldBe meta.sourceAsOf
            result.items.single().displayName shouldBe "스타벅스 강남점"
            result.items.single().autoSelected shouldBe true
            result.items.single().latitude shouldBe store.latitude
            result.totalStores shouldBe 1
            result.radiusKm shouldBe 1.0
            result.items.single().menuAvailability shouldBe "UNVERIFIED"
        }
        Then("district uses official center and never accepts user coordinates simultaneously") {
            service.search(CafeNearbyRequest(CafeLocation("AREA", areaCode = area.code), group = "라떼")).areaLabel shouldBe "강남구"
            shouldThrow<CafeNearbyInvalid> { service.search(CafeNearbyRequest(CafeLocation("AREA", 37.5, 127.0, area.code), group = "라떼")) }
        }
        Then("multiple variants stay unselected and numeric nulls follow selected before pagination") {
            val other = row.copy(drinkKey = "different", sizeLabel = "L", sugarG = BigDecimal.ONE)
            every { drinks.search(any()) } returns CafeDrinkPage(listOf(row, other), 2, 0, 200)
            service.search(CafeNearbyRequest(CafeLocation("CURRENT", 37.5, 127.0), group = "라떼")).items.single().selectionRequired shouldBe true
            every { drinks.find(other.drinkKey) } returns other
            val selected = service.search(CafeNearbyRequest(CafeLocation("CURRENT", 37.5, 127.0), group = "라떼", selectedDrinkKeys = listOf(other.drinkKey)))
            selected.items.single().selectedDrink?.drinkKey shouldBe "different"
            selected.items.single().autoSelected shouldBe false
            shouldThrow<CafeNearbyInvalid> { service.search(CafeNearbyRequest(CafeLocation("CURRENT", 37.5, 127.0), group = "라떼", selectedDrinkKeys = listOf(other.drinkKey, other.drinkKey))) }
        }
        Then("empty group, invalid coordinates, radius and paging fail generically before repository candidate queries") {
            listOf(CafeNearbyRequest(CafeLocation("CURRENT", Double.NaN, 127.0), group = "라떼"), CafeNearbyRequest(CafeLocation("CURRENT", 37.5, 127.0)), CafeNearbyRequest(CafeLocation("CURRENT", 37.5, 127.0), group = "라떼", radiusKm = 2.0)).forEach { invalid -> shouldThrow<CafeNearbyInvalid> { service.search(invalid) } }
            verify(exactly = 0) { port.candidates(any(), any(), any(), any(), any()) }
        }
        Then("outside coverage and genuinely empty results stay distinct") {
            service.search(CafeNearbyRequest(CafeLocation("CURRENT", 0.0, 0.0), group = "라떼")).coverage.status shouldBe "UNSUPPORTED"
            every { port.candidates(any(), any(), any(), any(), any()) } returns emptyList()
            service.search(CafeNearbyRequest(CafeLocation("CURRENT", 37.5, 127.0), group = "라떼")).coverage.status shouldBe "SUPPORTED"
        }
        Then("physical stores without matching nutrition are distinct from no stores") {
            every { drinks.search(any()) } returns CafeDrinkPage(emptyList(), 0, 0, 200)
            val result = service.search(CafeNearbyRequest(CafeLocation("CURRENT", 37.5, 127.0), group = "라떼"))
            result.totalStores shouldBe 0
            result.nearbyStoresWithoutNutrition shouldBe 1
            result.items shouldBe emptyList()
        }
        Then("45-day stale and 90-day expiry gates preserve null source date") {
            every { port.metadata() } returns meta.copy(sourceAsOf = LocalDate.now().minusDays(46))
            service.capability().reason shouldBe "STALE"
            service.search(CafeNearbyRequest(CafeLocation("CURRENT", 37.5, 127.0), group = "라떼")).coverage.status shouldBe "STALE"
            every { port.metadata() } returns meta.copy(sourceAsOf = LocalDate.now().minusDays(91))
            service.capability().nearbyEnabled shouldBe false
            shouldThrow<CafeNearbyUnavailable> { service.search(CafeNearbyRequest(CafeLocation("CURRENT", 37.5, 127.0), group = "라떼")) }
            every { port.metadata() } returns meta.copy(sourceAsOf = null)
            service.capability().sourceAsOf shouldBe null
        }
        Then("unverified source and missing centers keep entry disabled") {
            CafeNearbyService(port, drinks, false).capability().nearbyEnabled shouldBe false
            every { port.areas(null) } returns emptyList()
            service.capability().nearbyEnabled shouldBe false
        }
        Then("partial and fixture snapshots never mutate") {
            val snapshot = CafeStoreSnapshot("v2", false, null, Instant.now(), "v1", listOf(store), listOf(province, area), 2, 1)
            shouldThrow<IllegalArgumentException> { service.sync(snapshot) }
            shouldThrow<IllegalArgumentException> { service.sync(snapshot.copy(complete = true, sourceTotal = 1, stores = listOf(store.copy(storeKey = "SAMPLE-1")))) }
            verify(exactly = 0) { port.replace(any()) }
        }
    }
})
