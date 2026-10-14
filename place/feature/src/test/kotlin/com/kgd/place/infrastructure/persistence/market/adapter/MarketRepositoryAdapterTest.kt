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
    Given("분기 변경으로 상가 원천 키만 달라진 재적재") {
        val old = MarketStore(1, "가게", MarketStoreSource.SANGGA, sourceKey = "old", sanggaKey = "old",
            sanggaRaw = "{}", jibunAddress = "경기 광명시 광명동 1", id = 99)
        every { stores.findByMarketIdAndSourceAndSourceKey(1, MarketStoreSource.SANGGA, "new") } returns null
        every { stores.findByMarketIdAndSanggaKey(1, "new") } returns null
        every { stores.findAllByMarketIdOrderByIdAsc(1) } returns listOf(MarketStoreJpaEntity.fromDomain(old))
        every { stores.save(any()) } answers { firstArg() }
        Then("유일한 동일 상호·필지의 ID를 재사용하고 override·MANUAL 행에는 쓰지 않는다") {
            val result = adapter.saveSourceStore(old.copy(id = null, sourceKey = "new", sanggaKey = "new"), setOf("new"))
            result.id shouldBe 99
            result.sourceKey shouldBe "new"
            result.sanggaKey shouldBe "new"
            verify(exactly = 0) { overrides.save(any()) }
            verify(exactly = 0) { stores.deleteAll() }
        }
    }
    Given("같은 이름과 필지의 서로 다른 현재 상가 ID") {
        val old = MarketStore(1, "가게", MarketStoreSource.SANGGA, sourceKey = "tenant-1", sanggaKey = "tenant-1",
            sanggaRaw = "{}", jibunAddress = "경기 광명시 광명동 1", id = 101)
        every { stores.findByMarketIdAndSourceAndSourceKey(1, MarketStoreSource.SANGGA, "tenant-2") } returns null
        every { stores.findByMarketIdAndSanggaKey(1, "tenant-2") } returns null
        every { stores.findAllByMarketIdOrderByIdAsc(1) } returns listOf(MarketStoreJpaEntity.fromDomain(old))
        every { stores.save(any()) } answers { firstArg() }
        Then("전체 현재 키 목록에 있는 임차인 ID는 다른 임차인으로 병합하지 않는다") {
            val result = adapter.saveSourceStore(old.copy(id = null, sourceKey = "tenant-2", sanggaKey = "tenant-2"),
                setOf("tenant-1", "tenant-2"))
            result.id shouldBe null
            result.sourceKey shouldBe "tenant-2"
        }
    }
    Given("상가정보 행이 다음 적재에서 온누리 가맹점으로 보강됨") {
        val old = MarketStore(1, "가게", MarketStoreSource.SANGGA, sourceKey = "s1", sanggaKey = "s1",
            sanggaRaw = "{}", jibunAddress = "경기 광명시 광명동 1", id = 102)
        every { stores.findByMarketIdAndSourceAndSourceKey(1, MarketStoreSource.ONNURI, "o1") } returns null
        every { stores.findByMarketIdAndSanggaKey(1, "s1") } returns MarketStoreJpaEntity.fromDomain(old)
        every { stores.save(any()) } answers { firstArg() }
        Then("같은 Sangga UNIQUE 키의 기존 ID를 승격하며 override를 유지한다") {
            val result = adapter.saveSourceStore(MarketStore(1, "가게", MarketStoreSource.ONNURI,
                sourceKey = "o1", onnuriKey = "o1", onnuriRaw = "{}", sanggaKey = "s1", sanggaRaw = "{}"), setOf("o1"))
            result.id shouldBe 102
            result.source shouldBe MarketStoreSource.ONNURI
            result.sanggaKey shouldBe "s1"
            verify(exactly = 0) { overrides.save(any()) }
            verify(exactly = 0) { stores.deleteAll() }
        }
    }
    Given("이미 별도 ID를 가진 온누리와 상가 행이 새로 매칭됨") {
        val merchant = MarketStore(1, "온누리 가게", MarketStoreSource.ONNURI, sourceKey = "o-existing",
            onnuriKey = "o-existing", onnuriRaw = "{}", id = 103)
        val sangga = MarketStore(1, "상가 가게", MarketStoreSource.SANGGA, sourceKey = "s-existing",
            sanggaKey = "s-existing", sanggaRaw = "{}", id = 104)
        every { stores.findByMarketIdAndSourceAndSourceKey(1, MarketStoreSource.ONNURI, "o-existing") } returns MarketStoreJpaEntity.fromDomain(merchant)
        every { stores.findByMarketIdAndSanggaKey(1, "s-existing") } returns MarketStoreJpaEntity.fromDomain(sangga)
        every { stores.save(any()) } answers { firstArg() }
        Then("두 ID와 기존 UNIQUE 소유권을 보존하고 온누리의 공간·원문 보강만 갱신한다") {
            val result = adapter.saveSourceStore(merchant.copy(id = null, sanggaKey = "s-existing",
                sanggaRaw = "{\"상가업소번호\":\"s-existing\"}", latitude = 37.48, longitude = 126.85),
                setOf("o-existing", "s-existing"))
            result.id shouldBe 103
            result.sanggaKey shouldBe null
            result.latitude shouldBe 37.48
            result.sanggaRaw shouldBe "{\"상가업소번호\":\"s-existing\"}"
            verify(exactly = 0) { stores.save(match { it.id == 104L }) }
            verify(exactly = 0) { overrides.save(any()) }
            verify(exactly = 0) { stores.deleteAll() }
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
