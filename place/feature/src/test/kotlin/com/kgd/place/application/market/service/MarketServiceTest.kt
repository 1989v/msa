package com.kgd.place.application.market.service

import com.kgd.place.application.market.port.MarketQueryPort
import com.kgd.place.application.market.port.MarketSavePort
import com.kgd.place.domain.market.model.Market
import com.kgd.place.domain.market.model.MarketActorKind
import com.kgd.place.domain.market.model.MarketMembership
import com.kgd.place.domain.market.model.MarketMembershipStatus
import com.kgd.place.domain.market.model.MarketStore
import com.kgd.place.domain.market.model.MarketStoreField
import com.kgd.place.domain.market.model.MarketStoreOverride
import com.kgd.place.domain.market.model.MarketStoreSource
import com.kgd.place.domain.market.model.MarketType
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk

class MarketServiceTest : BehaviorSpec({
    val query = mockk<MarketQueryPort>()
    val save = mockk<MarketSavePort>()
    val service = MarketService(query, save)
    val market = Market("content-1", "시장", MarketType.STREET, id = 1)
    fun store(id: Long, membership: MarketMembershipStatus) = MarketStore(
        marketId = 1, name = "가게$id", source = MarketStoreSource.MANUAL, id = id,
        actorKind = MarketActorKind.ADMIN, createdByMemberId = 7, membership = MarketMembership(membership),
    )
    Given("시장 표시 조회") {
        every { query.findMarketByContentId("content-1") } returns market
        every { query.findZones(1) } returns emptyList()
        every { query.findStores(1) } returns listOf(store(10, MarketMembershipStatus.OUT), store(11, MarketMembershipStatus.IN), store(12, MarketMembershipStatus.UNKNOWN))
        every { query.findOverrides(listOf(10, 11, 12)) } returns listOf(
            MarketStoreOverride(10, MarketStoreField.MEMBERSHIP, "IN", "현장 확인", 7, MarketActorKind.ADMIN),
            MarketStoreOverride(11, MarketStoreField.MEMBERSHIP, "OUT", "시장 밖", 7, MarketActorKind.ADMIN),
        )
        Then("원천 소속이 아닌 override가 적용된 소속으로 필터한다") {
            service.find("content-1", false)!!.stores.map { it.source.id } shouldBe listOf(10)
            service.find("content-1", true)!!.stores.map { it.source.id } shouldBe listOf(10, 11, 12)
        }
        Then("없는 시장은 데이터 없음으로 반환한다") {
            every { query.findMarketByContentId("missing") } returns null
            service.find("missing", false) shouldBe null
        }
    }
})
