package com.kgd.place.infrastructure.persistence.market.adapter

import com.kgd.place.domain.market.model.MarketStore
import com.kgd.place.domain.market.model.MarketActorKind
import com.kgd.place.domain.market.model.MarketStoreField
import com.kgd.place.domain.market.model.MarketStoreOverride
import com.kgd.place.domain.market.model.MarketStoreDisplay
import com.kgd.place.domain.market.model.MarketStoreSource
import com.kgd.place.domain.market.model.MarketZone
import com.kgd.place.domain.market.model.MarketZoneKind
import com.kgd.place.domain.market.model.MarketZoneSource
import com.kgd.place.infrastructure.persistence.market.entity.MarketStoreOverrideJpaEntity
import com.kgd.place.infrastructure.persistence.market.entity.MarketStoreJpaEntity
import com.kgd.place.infrastructure.persistence.market.entity.MarketZoneJpaEntity
import com.kgd.place.infrastructure.persistence.market.repository.MarketChangeLogJpaRepository
import com.kgd.place.infrastructure.persistence.market.repository.MarketJpaRepository
import com.kgd.place.infrastructure.persistence.market.repository.MarketStewardJpaRepository
import com.kgd.place.infrastructure.persistence.market.repository.MarketStoreJpaRepository
import com.kgd.place.infrastructure.persistence.market.repository.MarketStoreOverrideJpaRepository
import com.kgd.place.infrastructure.persistence.market.repository.MarketZoneJpaRepository
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import java.util.Optional

class MarketRepositoryAdapterTest : BehaviorSpec({
    val markets = mockk<MarketJpaRepository>()
    val zones = mockk<MarketZoneJpaRepository>()
    val stores = mockk<MarketStoreJpaRepository>()
    val overrides = mockk<MarketStoreOverrideJpaRepository>()
    val changes = mockk<MarketChangeLogJpaRepository>()
    val stewards = mockk<MarketStewardJpaRepository>()
    val adapter = MarketRepositoryAdapter(markets, zones, stores, overrides, changes, stewards)

    Given("원천 가게 재적재") {
        val old = MarketStore(1, "원천명", MarketStoreSource.ONNURI, sourceKey = "1", onnuriKey = "1",
            onnuriRaw = "{\"원천\":\"이전\"}", sanggaKey = "s1", sanggaRaw = "{\"보강\":\"유지\"}", id = 10)
        every { stores.findByMarketIdAndSourceAndSourceKey(1, MarketStoreSource.ONNURI, "1") } returns MarketStoreJpaEntity.fromDomain(old)
        every { stores.save(any()) } answers { firstArg() }
        Then("기존 ID와 보강을 유지하고 override 및 수동 행에는 쓰지 않는다") {
            val result = adapter.saveStore(old.copy(id = null, name = "새 이름", onnuriRaw = "{\"원천\":\"새 값\"}", sanggaRaw = null))
            result.id shouldBe 10
            result.name shouldBe "새 이름"
            result.sanggaRaw shouldBe old.sanggaRaw
            verify(exactly = 0) { overrides.save(any()) }
            verify(exactly = 0) { stores.deleteAll() }
        }
        Then("JSON 객체가 아닌 raw payload를 거부한다") {
            shouldThrow<IllegalArgumentException> { adapter.saveStore(old.copy(onnuriRaw = "[]")) }
        }
    }
    Given("합성 표시값 override 저장") {
        val source = MarketStore(1, "수동 가게", MarketStoreSource.MANUAL, id = 20,
            actorKind = MarketActorKind.ADMIN, createdByMemberId = 7, latitude = 37.5, longitude = 127.0)
        every { stores.findById(20) } returns Optional.of(MarketStoreJpaEntity.fromDomain(source))
        every { overrides.findAllByStoreIdIn(listOf(20)) } returns emptyList()
        fun field(field: MarketStoreField, value: String?) = MarketStoreOverride(
            20, field, value, "현장 확인", 7, MarketActorKind.ADMIN)
        Then("단독 좌표 해제와 근거 없는 참고 핀은 저장 전에 거부한다") {
            shouldThrow<IllegalArgumentException> { adapter.saveOverride(field(MarketStoreField.LATITUDE, null)) }
            shouldThrow<IllegalArgumentException> { adapter.saveOverride(field(MarketStoreField.LATITUDE, "37.6")) }
            shouldThrow<IllegalArgumentException> { adapter.saveOverride(field(MarketStoreField.PIN_KIND, "REFERENCE")) }
            verify(exactly = 0) { overrides.saveAll(any<List<MarketStoreOverrideJpaEntity>>()) }
        }
        Then("두 좌표 동시 해제는 하나의 유효한 묶음으로 저장한다") {
            every { overrides.saveAll(any<List<MarketStoreOverrideJpaEntity>>()) } answers { firstArg() }
            val saved = adapter.saveOverrides(listOf(field(MarketStoreField.LATITUDE, null), field(MarketStoreField.LONGITUDE, null)))
            saved.size shouldBe 2
            MarketStoreDisplay.from(source, saved).coordinate shouldBe null
            verify(exactly = 1) { overrides.saveAll(any<List<MarketStoreOverrideJpaEntity>>()) }
        }
    }
    Given("숫자 좌표 override와 원천 좌표 결측") {
        val source = MarketStore(1, "상가", MarketStoreSource.SANGGA, id = 30, sourceKey = "s30",
            sanggaKey = "s30", sanggaRaw = "{\"좌표\":\"원래 값\"}", latitude = 37.5, longitude = 127.0)
        every { stores.findById(30) } returns Optional.of(MarketStoreJpaEntity.fromDomain(source))
        every { overrides.findAllByStoreIdIn(listOf(30)) } returns emptyList()
        every { overrides.saveAll(any<List<MarketStoreOverrideJpaEntity>>()) } answers { firstArg() }
        Then("좌표 두 필드의 숫자 변경은 저장되고 원천 좌표가 없어져도 읽힌다") {
            val rows = listOf(
                MarketStoreOverride(30, MarketStoreField.LATITUDE, "37.6", "현장 확인", 7, MarketActorKind.ADMIN),
                MarketStoreOverride(30, MarketStoreField.LONGITUDE, "127.1", "현장 확인", 7, MarketActorKind.ADMIN),
            )
            val saved = adapter.saveOverrides(rows)
            saved.map { it.value } shouldBe listOf("37.6", "127.1")
            val reloaded = source.reloadSource(MarketStore(1, "상가", MarketStoreSource.SANGGA,
                sourceKey = "s30", sanggaKey = "s30", sanggaRaw = "{\"좌표\":null}"))
            reloaded.latitude shouldBe null
            reloaded.longitude shouldBe null
            val display = MarketStoreDisplay.from(reloaded, saved)
            display.coordinate!!.latitude shouldBe 37.6
            display.coordinate!!.longitude shouldBe 127.1
        }
    }
    Given("자동 구역 재적재") {
        val old = MarketZone(1, MarketZoneKind.ROAD, "먹거리 골목", MarketZoneSource.AUTO,
            sourceKey = "road:1", polygonWkt = "POLYGON((0 0,1 0,1 1,0 0))", sortOrder = 5, id = 3)
        every { zones.findByMarketIdAndSourceAndSourceKey(1, MarketZoneSource.AUTO, "road:1") } returns MarketZoneJpaEntity.fromDomain(old)
        every { zones.save(any()) } answers { firstArg() }
        Then("편집 이름·폴리곤·정렬을 보존하고 원천 도로명만 갱신한다") {
            val result = adapter.saveZone(old.copy(id = null, name = "원천 도로명", roadName = "새 도로", polygonWkt = null, sortOrder = 0))
            result.id shouldBe 3
            result.name shouldBe "먹거리 골목"
            result.polygonWkt shouldBe old.polygonWkt
            result.sortOrder shouldBe 5
            result.roadName shouldBe "새 도로"
        }
    }
})
