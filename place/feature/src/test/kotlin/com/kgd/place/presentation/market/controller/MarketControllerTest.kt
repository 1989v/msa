package com.kgd.place.presentation.market.controller

import com.kgd.common.exception.GlobalExceptionHandler
import com.kgd.place.application.market.usecase.QueryMarketUseCase
import com.kgd.place.domain.market.model.Market
import com.kgd.place.domain.market.model.MarketActorKind
import com.kgd.place.domain.market.model.MarketMembership
import com.kgd.place.domain.market.model.MarketMembershipStatus
import com.kgd.place.domain.market.model.MarketPinKind
import com.kgd.place.domain.market.model.MarketStore
import com.kgd.place.domain.market.model.MarketStoreDisplay
import com.kgd.place.domain.market.model.MarketStoreSource
import com.kgd.place.domain.market.model.MarketType
import com.kgd.place.domain.market.model.MarketZone
import com.kgd.place.domain.market.model.MarketZoneKind
import com.kgd.place.domain.market.model.MarketZoneSource
import io.kotest.core.spec.style.BehaviorSpec
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.header
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import tools.jackson.module.kotlin.jacksonMapperBuilder

class MarketControllerTest : BehaviorSpec({
    val query = mockk<QueryMarketUseCase>()
    val mvc = MockMvcBuilders.standaloneSetup(MarketController(query))
        .setControllerAdvice(GlobalExceptionHandler())
        .setMessageConverters(JacksonJsonHttpMessageConverter(jacksonMapperBuilder().build()))
        .build()
    val path = "/api/v1/place/markets/content-1"
    val market = Market("content-1", "광명시장", MarketType.MIXED, sourceKey = "source-1",
        marketInfoMatched = true, sourceRaw = "{}", id = 1, storeCountRaw = "200", openingCycle = "상설")
    fun zone(id: Long, kind: MarketZoneKind, order: Int, parent: Long? = null) =
        MarketZone(1, kind, "구역$id", MarketZoneSource.MANUAL, parentId = parent, sortOrder = order, id = id)
    beforeEach { clearMocks(query) }

    Given("공개 시장 상세") {
        Then("기본 요청을 래핑하고 출처와 캐시 헤더를 반환한다") {
            every { query.find("content-1", false, "ko") } returns QueryMarketUseCase.MarketResult(market, emptyList(), emptyList())
            mvc.perform(get(path))
                .andExpect(status().isOk)
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.market.contentId").value("content-1"))
                .andExpect(jsonPath("$.data.market.attribution.name").value("전국전통시장표준데이터"))
                .andExpect(jsonPath("$.data.market.attribution.url").value("https://www.data.go.kr/data/15012894/standard.do"))
                .andExpect(jsonPath("$.data.market.sourceRaw").doesNotExist())
                .andExpect(header().string("Cache-Control", "max-age=60, public, s-maxage=600, stale-while-revalidate=300"))
        }
        Then("영문 요청은 국문 원본과 로마자 이름 및 참고 핀 출처를 보존한다") {
            val store = MarketStore(1, "우리 떡집", MarketStoreSource.MANUAL, items = "떡", id = 10,
                actorKind = MarketActorKind.STEWARD, createdByMemberId = 7, jibunAddress = "광명동 1",
                latitude = 37.0, longitude = 127.0, membership = MarketMembership(MarketMembershipStatus.IN),
                pinKind = MarketPinKind.REFERENCE, referenceStoreId = 11, relativePosition = "왼쪽", positionNote = "입구 옆")
            every { query.find("content-1", true, "en") } returns QueryMarketUseCase.MarketResult(market, emptyList(),
                listOf(QueryMarketUseCase.Store(store, MarketStoreDisplay.from(store, emptyList()))))
            mvc.perform(get(path).param("lang", "en").param("includeOutside", "true"))
                .andExpect(status().isOk)
                .andExpect(jsonPath("$.data.stores[0].name").value("우리 떡집"))
                .andExpect(jsonPath("$.data.stores[0].nameEn").value("Uri Tteokjip"))
                .andExpect(jsonPath("$.data.stores[0].items").value("떡"))
                .andExpect(jsonPath("$.data.stores[0].sources[0]").value("MANUAL"))
                .andExpect(jsonPath("$.data.stores[0].manual").value(true))
                .andExpect(jsonPath("$.data.stores[0].pinKind").value("REFERENCE"))
                .andExpect(jsonPath("$.data.stores[0].actorKind").value("STEWARD"))
                .andExpect(jsonPath("$.data.stores[0].jibunAddress").value("광명동 1"))
                .andExpect(jsonPath("$.data.stores[0].referenceStoreId").value(11))
                .andExpect(jsonPath("$.data.stores[0].createdByMemberId").doesNotExist())
        }
        Then("골목과 건물은 순서대로 건물의 층은 자식 순서대로 반환한다") {
            val zones = listOf(zone(21, MarketZoneKind.FLOOR, 2, 20), zone(20, MarketZoneKind.BUILDING, 2),
                zone(22, MarketZoneKind.FLOOR, 1, 20), zone(10, MarketZoneKind.ROAD, 1))
            every { query.find("content-1", false, "ko") } returns QueryMarketUseCase.MarketResult(market, zones, emptyList())
            mvc.perform(get(path))
                .andExpect(status().isOk)
                .andExpect(jsonPath("$.data.zones.length()").value(2))
                .andExpect(jsonPath("$.data.zones[0].kind").value("ROAD"))
                .andExpect(jsonPath("$.data.zones[1].kind").value("BUILDING"))
                .andExpect(jsonPath("$.data.zones[1].children[0].id").value(22))
                .andExpect(jsonPath("$.data.zones[1].children[1].id").value(21))
        }
        Then("미매칭 시장은 표준데이터 출처를 주장하지 않는다") {
            every { query.find("content-1", false, "ko") } returns QueryMarketUseCase.MarketResult(
                market.copy(marketInfoMatched = false, sourceKey = null, sourceRaw = null), emptyList(), emptyList())
            mvc.perform(get(path))
                .andExpect(status().isOk)
                .andExpect(jsonPath("$.data.market.marketInfoMatched").value(false))
                .andExpect(jsonPath("$.data.market.attribution").doesNotExist())
        }
        Then("없는 시장은 HTTP 200과 null 데이터를 반환한다") {
            every { query.find("content-1", false, "ko") } returns null
            mvc.perform(get(path)).andExpect(status().isOk)
                .andExpect(jsonPath("$.success").value(true)).andExpect(jsonPath("$.data").doesNotExist())
        }
    }
    Given("지원하지 않는 파라미터") {
        Then("잘못된 언어를 400으로 거부하며 조회하지 않는다") {
            mvc.perform(get(path).param("lang", "ja")).andExpect(status().isBadRequest)
            verify(exactly = 0) { query.find(any(), any(), any()) }
        }
        Then("잘못된 토글을 400으로 거부한다") {
            mvc.perform(get(path).param("includeOutside", "maybe")).andExpect(status().isBadRequest)
            verify(exactly = 0) { query.find(any(), any(), any()) }
        }
    }
})
