package com.kgd.place.application.market.service

import com.kgd.place.application.market.usecase.QueryMarketUseCase
import com.kgd.place.domain.market.model.*
import com.kgd.place.presentation.market.dto.MarketResponse
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class MarketStoreNumberProjectionTest : BehaviorSpec({
    val market = Market("990539", "경주 중앙시장", MarketType.STREET, id = 1)
    fun onnuri(id: Long, address: String, jibun: String) = MarketStore(1, "가게$id", MarketStoreSource.ONNURI,
        sourceKey = "o$id", id = id, onnuriKey = "o$id", onnuriRaw = """{"점포명":"가게$id","주소":"$address"}""",
        jibunAddress = jibun, latitude = 35.84, longitude = 129.2, membership = MarketMembership(MarketMembershipStatus.IN))
    fun response(rows: List<MarketStore>) =
        MarketResponse.from(QueryMarketUseCase.MarketResult(market, emptyList(), MarketPublicProjection.stores(rows, emptyMap())))
    Given("온누리 원문 주소에 가게 번호가 있는 가맹점") {
        Then("응답의 storeNo 는 원문 주소에서 읽고, 지번주소가 상가정보로 바뀐 행은 그 필지로 경계를 정한다") {
            val stores = response(listOf(
                onnuri(1, "경북경주시성건동339-2번지중앙시장5-21호", "경상북도 경주시 성건동 339-2"),
                onnuri(2, "경북경주시성건동339-24동-8", "경상북도 경주시 성건동 339-2"),
                onnuri(3, "경북경주시성건동339-2", "경북경주시성건동339-2"),
            )).stores.associate { it.id to it.storeNo }
            stores shouldBe mapOf(1L to "5-21호", 2L to "4동 8", 3L to null)
        }
        Then("온누리 원문이 없는 상가정보 행은 번호가 없다") {
            val sangga = MarketStore(1, "가게", MarketStoreSource.SANGGA, sourceKey = "s1", id = 9, sanggaKey = "s1",
                sanggaRaw = "{}", jibunAddress = "경상북도 경주시 성건동 339-2", membership = MarketMembership(MarketMembershipStatus.IN))
            response(listOf(sangga)).stores.single().storeNo shouldBe null
        }
    }
})
