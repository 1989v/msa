package com.kgd.place.application.market.service

import com.kgd.place.application.market.usecase.QueryMarketUseCase
import com.kgd.place.domain.market.model.*
import com.kgd.place.presentation.market.dto.MarketResponse
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import tools.jackson.module.kotlin.jacksonMapperBuilder

class MarketGoodPriceProjectionTest : BehaviorSpec({
    val market = Market("content", "시장", MarketType.STREET, id = 1)
    val raw = """{"업종":"한식","메뉴1":"국수","가격1":"5,000원","메뉴2":"수제비","가격2":"6000","주소":"원본 주소"}"""
    fun store(id: Long, status: MarketMembershipStatus = MarketMembershipStatus.IN, json: String? = raw,
        source: MarketStoreSource = MarketStoreSource.MANUAL) = MarketStore(1, "가게", source,
        sourceKey = "source$id", id = id, actorKind = MarketActorKind.ADMIN, createdByMemberId = 7,
        onnuriKey = if (source == MarketStoreSource.ONNURI) "o$id" else null,
        onnuriRaw = if (source == MarketStoreSource.ONNURI) "{}" else null,
        sanggaKey = if (source == MarketStoreSource.SANGGA) "s$id" else null,
        sanggaRaw = if (source == MarketStoreSource.SANGGA) "{}" else null,
        jibunAddress = "중구 1", membership = MarketMembership(status),
        goodPriceKey = if (json == null) null else "private-key", goodPriceRaw = json,
        goodPriceMatchedBy = if (json == null) null else "ROAD")
    fun response(rows: List<MarketStore>, edits: Map<Long, List<MarketStoreOverride>> = emptyMap()) =
        MarketResponse.from(QueryMarketUseCase.MarketResult(market, emptyList(), MarketPublicProjection.stores(rows, edits)))
    Given("착한가격 공개 표시와 시장 집계") {
        Then("보정된 IN만 집계하고 OUT 및 UNKNOWN 메뉴 가격은 제외하며 가게 정보는 유지한다") {
            fun edit(id: Long, value: String) = MarketStoreOverride(id, MarketStoreField.MEMBERSHIP, value,
                "현장 확인", 7, MarketActorKind.ADMIN)
            val result = response(listOf(store(1, MarketMembershipStatus.OUT), store(2),
                store(3, MarketMembershipStatus.UNKNOWN, """{"메뉴1":"비싼메뉴","가격1":"99999"}""")),
                mapOf(1L to listOf(edit(1, "IN")), 2L to listOf(edit(2, "OUT"))))
            result.market.goodPrice?.storeCount shouldBe 1
            result.market.goodPrice?.minPrice shouldBe 5000
            result.market.goodPrice?.maxPrice shouldBe 6000
            result.market.goodPrice?.attribution shouldBe MarketResponse.Attribution("행정안전부 착한가격업소",
                "https://www.data.go.kr/data/3045247/fileData.do", "이용허락범위 제한 없음")
            result.stores[1].goodPrice?.menus?.size shouldBe 2
            result.stores.first().goodPrice?.category shouldBe "한식"
            result.stores.first().goodPrice?.matchedBy shouldBe "ROAD"
        }
        Then("지정 가게가 있지만 가격을 읽지 못하면 집계 가격은 null이고 지정 가게가 없으면 집계가 null이다") {
            val summary = response(listOf(store(1, json = """{"메뉴1":"국수","가격1":""}"""))).market.goodPrice
            summary?.storeCount shouldBe 1
            summary?.minPrice shouldBe null
            summary?.maxPrice shouldBe null
            response(listOf(store(1, json = null))).market.goodPrice shouldBe null
            response(emptyList()).market.goodPrice shouldBe null
            response(listOf(store(1, MarketMembershipStatus.OUT))).market.goodPrice shouldBe null
        }
        Then("상가에만 있는 지정 정보도 온누리 정본에 보존하고 한 곳으로 집계한다") {
            val result = response(listOf(store(1, json = null, source = MarketStoreSource.ONNURI),
                store(2, source = MarketStoreSource.SANGGA)))
            result.stores.size shouldBe 1
            result.stores.single().id shouldBe 1
            result.stores.single().goodPrice?.menus?.first() shouldBe GoodPriceMenu("국수", 5000)
            result.market.goodPrice?.storeCount shouldBe 1
        }
        Then("공개 JSON에는 원문과 원천 키와 파생 검색 필드를 포함하지 않는다") {
            val tree = jacksonMapperBuilder().build().valueToTree<tools.jackson.databind.JsonNode>(response(listOf(store(1))))
            val publicStore = tree["stores"][0]
            publicStore.has("goodPriceRaw") shouldBe false
            publicStore.has("goodPriceKey") shouldBe false
            publicStore.has("goodPriceMenuNames") shouldBe false
            publicStore["goodPrice"].has("주소") shouldBe false
            publicStore["goodPrice"]["menus"][0]["price"].asInt() shouldBe 5000
        }
    }
})
