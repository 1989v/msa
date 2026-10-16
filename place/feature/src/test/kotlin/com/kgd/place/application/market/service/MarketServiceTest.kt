package com.kgd.place.application.market.service

import com.kgd.place.application.market.port.MarketQueryPort
import com.kgd.place.application.market.port.MarketSavePort
import com.kgd.place.domain.market.model.Market
import com.kgd.place.domain.market.model.MarketCoordinate
import com.kgd.place.domain.market.model.MarketActorKind
import com.kgd.place.domain.market.model.MarketMembership
import com.kgd.place.domain.market.model.MarketPinKind
import com.kgd.place.domain.market.model.MarketMembershipStatus
import com.kgd.place.domain.market.model.MarketStore
import com.kgd.place.domain.market.model.MarketStoreField
import com.kgd.place.domain.market.model.MarketStoreOverride
import com.kgd.place.domain.market.model.MarketStoreSource
import com.kgd.place.domain.market.model.MarketType
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify

class MarketServiceTest : BehaviorSpec({
    val query = mockk<MarketQueryPort>()
    val save = mockk<MarketSavePort>()
    val service = MarketService(query, save)
    val market = Market("content-1", "시장", MarketType.STREET, id = 1)
    fun store(id: Long, membership: MarketMembershipStatus = MarketMembershipStatus.IN,
              source: MarketStoreSource = MarketStoreSource.MANUAL, name: String = "가게$id", jibun: String? = "광명동 1") = MarketStore(
        marketId = 1, name = name, source = source, id = id, sourceKey = "key$id",
        onnuriKey = if (source == MarketStoreSource.ONNURI) "o$id" else null,
        onnuriRaw = if (source == MarketStoreSource.ONNURI) "{}" else null,
        sanggaKey = if (source == MarketStoreSource.SANGGA) "s$id" else null,
        sanggaRaw = if (source == MarketStoreSource.SANGGA) "{}" else null,
        actorKind = if (source == MarketStoreSource.MANUAL) MarketActorKind.ADMIN else null,
        createdByMemberId = if (source == MarketStoreSource.MANUAL) 7 else null,
        membership = MarketMembership(membership), jibunAddress = jibun, latitude = 37.0, longitude = 127.0,
    )
    fun edit(id: Long, field: MarketStoreField, value: String?) =
        MarketStoreOverride(id, field, value, "현장 확인", 7, MarketActorKind.ADMIN)
    fun rows(stores: List<MarketStore>, edits: List<MarketStoreOverride> = emptyList()) {
        every { query.findStores(1) } returns stores
        every { query.findOverrides(stores.mapNotNull { it.id }) } returns edits
    }
    beforeEach {
        clearMocks(query, save)
        every { query.findMarketByContentId("content-1") } returns market
        every { query.findZones(1) } returns emptyList()
    }
    Given("OSM 수집 시각") {
        Then("마지막 수집 시각을 상태에 실어 적재 잡이 최근 수집한 시장을 건너뛰게 한다") {
            val edits = mockk<com.kgd.place.application.market.port.MarketGeometryEditPort>()
            val fetchedAt = java.time.LocalDateTime.of(2026, 10, 16, 5, 30)
            every { edits.findEntrances(1) } returns emptyList()
            every { edits.findRawFetchedAt(1) } returns fetchedAt
            rows(listOf(store(10)))
            MarketService(query, save, geometryEdits = edits).find("content-1", true)!!.osmFetchedAt shouldBe fetchedAt
            service.find("content-1", true)!!.osmFetchedAt shouldBe null
        }
    }
    Given("시장 소속 공개 규칙") {
        Then("IN은 핀과 함께, UNKNOWN은 좌표 없이 노출하고 OUT은 토글로 노출한다") {
            rows(listOf(store(10), store(11, MarketMembershipStatus.OUT), store(12, MarketMembershipStatus.UNKNOWN)))
            val normal = service.find("content-1", false)!!.stores
            normal.map { it.source.id } shouldBe listOf(10L, 12L)
            normal.first().display.coordinate shouldBe MarketCoordinate(37.0, 127.0)
            normal.last().display.coordinate shouldBe null
            val outside = service.find("content-1", true)!!.stores
            outside.map { it.source.id } shouldBe listOf(10L, 11L, 12L)
            outside.last().display.coordinate shouldBe null
        }
        Then("소속 override 후 노출 및 UNKNOWN 좌표 억제를 판정한다") {
            rows(listOf(store(10, MarketMembershipStatus.OUT), store(11), store(12)), listOf(
                edit(10, MarketStoreField.MEMBERSHIP, "IN"), edit(11, MarketStoreField.MEMBERSHIP, "OUT"),
                edit(12, MarketStoreField.MEMBERSHIP, "UNKNOWN"),
                edit(12, MarketStoreField.LATITUDE, "38"), edit(12, MarketStoreField.LONGITUDE, "128"),
            ))
            val result = service.find("content-1", false)!!.stores
            result.map { it.source.id } shouldBe listOf(10L, 12L)
            result.last().display.coordinate shouldBe null
        }
        Then("이름 품목 구역과 좌표 override가 원천을 바꾸지 않는다") {
            val original = store(10).copy(items = "원품목")
            rows(listOf(original), listOf(edit(10, MarketStoreField.NAME, "수정명"), edit(10, MarketStoreField.ITEMS, null),
                edit(10, MarketStoreField.ZONE_ID, "3"), edit(10, MarketStoreField.LATITUDE, "38"), edit(10, MarketStoreField.LONGITUDE, "128")))
            val result = service.find("content-1")!!.stores.single()
            result.display.name shouldBe "수정명"
            result.display.items shouldBe null
            result.display.zoneId shouldBe 3L
            result.display.coordinate shouldBe MarketCoordinate(38.0, 128.0)
            original.name shouldBe "가게10"
            original.latitude shouldBe 37.0
        }
        Then("가게 수와 무관하게 시장 가게 override 구역 네 번만 읽는다") {
            rows((1L..2000L).map { store(it) })
            service.find("content-1")!!.stores.size shouldBe 2000
            verify(exactly = 1) { query.findMarketByContentId("content-1") }
            verify(exactly = 1) { query.findStores(1) }
            verify(exactly = 1) { query.findOverrides((1L..2000L).toList()) }
            verify(exactly = 1) { query.findZones(1) }
            verify(exactly = 0) { save.saveStore(any()) }
        }
        Then("없는 시장은 추가 조회 없이 null이다") {
            every { query.findMarketByContentId("missing") } returns null
            service.find("missing") shouldBe null
            verify(exactly = 0) { query.findStores(any()); query.findOverrides(any()); query.findZones(any()) }
        }
    }
    Given("IN이 없는 시장의 주변 가게 표시") {
        val center = market.copy(latitude = 37.0, longitude = 127.0)
        fun outside(id: Long, metres: Double) = store(id, MarketMembershipStatus.OUT)
            .copy(latitude = 37.0 + metres / 111320.0)
        beforeEach { every { query.findMarketByContentId("content-1") } returns center }

        Then("100m 안에 30곳이면 확장하지 않고 OUT 소속과 원천을 보존한다") {
            val input = (1L..30L).map { outside(it, 90.0) } + outside(31, 120.0)
            rows(input)
            val result = requireNotNull(service.find("content-1"))
            result.nearbyRadiusMetres shouldBe 100
            result.stores.map { it.source.id } shouldBe (1L..30L).toList()
            result.stores.all { it.display.nearby && it.display.membership.status == MarketMembershipStatus.OUT } shouldBe true
            input.all { it.membership.status == MarketMembershipStatus.OUT } shouldBe true
            verify(exactly = 0) { save.saveStore(any()) }
        }
        Then("50m씩 확장해 처음 30곳이 된 200m에서 멈춘다") {
            rows((1L..29L).map { outside(it, 90.0) } + outside(30, 180.0) + outside(31, 220.0))
            val result = requireNotNull(service.find("content-1"))
            result.nearbyRadiusMetres shouldBe 200
            result.stores.map { it.source.id } shouldBe (1L..30L).toList()
        }
        listOf(150, 250).forEach { radius ->
            Then("처음 30곳이 된 ${radius}m에서도 다음 단계로 확장하지 않는다") {
                rows((1L..29L).map { outside(it, 90.0) } + outside(30, radius - 10.0) + outside(31, radius + 10.0))
                val result = requireNotNull(service.find("content-1"))
                result.nearbyRadiusMetres shouldBe radius
                result.stores.map { it.source.id } shouldBe (1L..30L).toList()
            }
        }
        Then("30곳 미만이어도 300m에서 멈추고 UNKNOWN 목록은 유지한다") {
            rows(listOf(outside(1, 290.0), outside(2, 310.0), store(3, MarketMembershipStatus.UNKNOWN)))
            val result = requireNotNull(service.find("content-1"))
            result.nearbyRadiusMetres shouldBe 300
            result.stores.map { it.source.id } shouldBe listOf(1L, 3L)
            result.stores.last().display.nearby shouldBe false
            result.stores.last().display.coordinate shouldBe null
        }
        Then("중심이 없으면 주변을 더하지 않는다") {
            every { query.findMarketByContentId("content-1") } returns market
            rows(listOf(outside(1, 10.0)))
            val result = requireNotNull(service.find("content-1"))
            result.stores shouldBe emptyList()
            result.nearbyRadiusMetres shouldBe null
        }
        Then("실효 IN 편집이 있으면 주변을 더하지 않는다") {
            rows(listOf(outside(1, 10.0), outside(2, 20.0)), listOf(edit(1, MarketStoreField.MEMBERSHIP, "IN")))
            val result = requireNotNull(service.find("content-1"))
            result.stores.map { it.source.id } shouldBe listOf(1L)
            result.stores.single().display.nearby shouldBe false
            result.nearbyRadiusMetres shouldBe null
        }
        Then("원천 IN을 OUT으로 편집하면 주변 표시를 적용한다") {
            rows(listOf(store(1), outside(2, 20.0)), listOf(edit(1, MarketStoreField.MEMBERSHIP, "OUT")))
            val result = requireNotNull(service.find("content-1"))
            result.stores.all { it.display.nearby && it.display.membership.status == MarketMembershipStatus.OUT } shouldBe true
            result.nearbyRadiusMetres shouldBe 300
        }
        Then("전체 보기에서도 같은 주변 집합만 표시하고 반경은 내보내지 않는다") {
            rows((1L..29L).map { outside(it, 90.0) } + outside(30, 180.0) + outside(31, 220.0))
            val normal = requireNotNull(service.find("content-1"))
            val all = requireNotNull(service.find("content-1", true))
            all.stores.size shouldBe 31
            all.stores.filter { it.display.nearby }.map { it.source.id } shouldBe normal.stores.map { it.source.id }
            all.nearbyRadiusMetres shouldBe null
        }
        Then("경계 중심이 시장 좌표보다 우선하며 닫는 꼭짓점에 치우치지 않는다") {
            val geometry = mockk<com.kgd.place.application.market.port.MarketGeometryQueryPort>()
            val polygon = listOf(MarketCoordinate(37.009, 126.999), MarketCoordinate(37.009, 127.001),
                MarketCoordinate(37.011, 127.001), MarketCoordinate(37.011, 126.999), MarketCoordinate(37.009, 126.999))
            every { geometry.findBoundary(1) } returns com.kgd.place.domain.market.model.MarketBoundary(
                1, polygon, com.kgd.place.domain.market.model.MarketGeometrySource.MANUAL)
            every { geometry.findPaths(1) } returns emptyList()
            rows((1L..30L).map { outside(it, 0.0).copy(latitude = 37.01) } + outside(31, 0.0))
            val result = requireNotNull(MarketService(query, save, geometry).find("content-1"))
            result.nearbyRadiusMetres shouldBe 100
            result.stores.map { it.source.id } shouldBe (1L..30L).toList()
        }
        Then("공개 DTO가 주변 배지와 반경을 전달한다") {
            rows(listOf(outside(1, 10.0)))
            val response = com.kgd.place.presentation.market.dto.MarketResponse.from(requireNotNull(service.find("content-1")))
            response.nearbyRadiusMetres shouldBe 300
            response.stores.single().nearby shouldBe true
            response.stores.single().membership shouldBe MarketMembershipStatus.OUT
        }
    }
    Given("같은 이름 지번의 온누리와 상가 행") {
        Then("정규화 원천 이름으로 하나로 합치고 양쪽 출처와 편집값을 보존한다") {
            val onnuri = store(10, source = MarketStoreSource.ONNURI, name = "광명 떡집").copy(latitude = null, longitude = null)
            val sangga = store(11, source = MarketStoreSource.SANGGA, name = "광명떡집", jibun = "광명동   1")
            rows(listOf(sangga, onnuri), listOf(edit(10, MarketStoreField.NAME, "상인회 이름"),
                edit(11, MarketStoreField.ITEMS, "떡"), edit(11, MarketStoreField.ZONE_ID, "5")))
            val result = service.find("content-1")!!.stores.single()
            result.source.id shouldBe 10L
            result.sources shouldBe listOf(MarketStoreSource.ONNURI, MarketStoreSource.SANGGA)
            result.display.name shouldBe "상인회 이름"
            result.display.items shouldBe "떡"
            result.display.zoneId shouldBe 5L
            result.display.coordinate shouldBe MarketCoordinate(37.0, 127.0)
            onnuri.latitude shouldBe null
            sangga.name shouldBe "광명떡집"
        }
        Then("참고 핀의 기준 가게 ID도 응답에 남는 온누리 ID로 매핑한다") {
            val manual = store(12).copy(pinKind = MarketPinKind.REFERENCE, referenceStoreId = 11, relativePosition = "오른쪽")
            rows(listOf(store(10, source = MarketStoreSource.ONNURI, name = "떡집"),
                store(11, source = MarketStoreSource.SANGGA, name = "떡집"), manual))
            val result = service.find("content-1")!!.stores
            result.map { it.source.id } shouldBe listOf(10L, 12L)
            result.last().source.referenceStoreId shouldBe 10L
            result.last().display.pinKind shouldBe MarketPinKind.REFERENCE
            manual.referenceStoreId shouldBe 11L
        }
        Then("온누리의 명시적 OUT 편집이 중복 상가 IN으로 되살아나지 않는다") {
            rows(listOf(store(10, source = MarketStoreSource.ONNURI, name = "떡집"),
                store(11, source = MarketStoreSource.SANGGA, name = "떡집")),
                listOf(edit(10, MarketStoreField.MEMBERSHIP, "OUT"), edit(11, MarketStoreField.MEMBERSHIP, "IN")))
            service.find("content-1")!!.stores shouldBe emptyList()
            service.find("content-1", true)!!.stores.single().display.membership.status shouldBe MarketMembershipStatus.OUT
        }
        Then("상가 소속 편집도 온누리 원천값보다 우선한다") {
            rows(listOf(store(10, source = MarketStoreSource.ONNURI, name = "떡집"),
                store(11, source = MarketStoreSource.SANGGA, name = "떡집")), listOf(edit(11, MarketStoreField.MEMBERSHIP, "UNKNOWN")))
            service.find("content-1")!!.stores.single().display.coordinate shouldBe null
        }
        Then("이미 상가 원문이나 키가 보강된 온누리도 두 출처를 가진다") {
            rows(listOf(store(10, source = MarketStoreSource.ONNURI).copy(sanggaKey = "enriched", sanggaRaw = "{}")))
            service.find("content-1")!!.stores.single().sources shouldBe listOf(MarketStoreSource.ONNURI, MarketStoreSource.SANGGA)
        }
        Then("지번 없는 행 같은 원천 행 수동 행 다른 필지는 합치지 않는다") {
            val input = listOf(
                store(10, source = MarketStoreSource.ONNURI, name = "떡집", jibun = null),
                store(11, source = MarketStoreSource.SANGGA, name = "떡집", jibun = null),
                store(12, source = MarketStoreSource.ONNURI, name = "국밥"),
                store(13, source = MarketStoreSource.ONNURI, name = "국밥"),
                store(14, source = MarketStoreSource.MANUAL, name = "국밥"),
                store(15, source = MarketStoreSource.SANGGA, name = "국밥", jibun = "광명동 2"),
            )
            rows(input)
            service.find("content-1")!!.stores.map { it.source.id } shouldBe input.map { it.id }
        }
        Then("한 원천에서 이름 지번이 중복되면 모호한 후보를 합치지 않는다") {
            rows(listOf(store(10, source = MarketStoreSource.ONNURI, name = "떡집"),
                store(11, source = MarketStoreSource.SANGGA, name = "떡집"), store(12, source = MarketStoreSource.SANGGA, name = "떡집")))
            service.find("content-1")!!.stores.size shouldBe 3
        }
    }
})
