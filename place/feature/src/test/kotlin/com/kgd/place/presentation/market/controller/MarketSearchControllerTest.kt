package com.kgd.place.presentation.market.controller

import com.kgd.common.exception.GlobalExceptionHandler
import com.kgd.place.application.market.port.MarketSearchPort
import com.kgd.place.application.market.service.MarketSearchService
import com.kgd.place.application.market.usecase.SearchMarketsUseCase
import io.kotest.core.spec.style.BehaviorSpec
import io.mockk.every
import io.mockk.mockk
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.*
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import tools.jackson.module.kotlin.jacksonMapperBuilder

class MarketSearchControllerTest : BehaviorSpec({
    val port = mockk<MarketSearchPort>()
    val mvc = MockMvcBuilders.standaloneSetup(MarketSearchController(MarketSearchService(port)))
        .setControllerAdvice(GlobalExceptionHandler())
        .setMessageConverters(JacksonJsonHttpMessageConverter(jacksonMapperBuilder().build())).build()
    Given("공개 검색 계약") {
        Then("공백을 제거한 검색어와 기본 페이지를 반환한다") {
            every { port.search("떡집", "ko", 0, 20) } returns SearchMarketsUseCase.Result("떡집", emptyList(),
                SearchMarketsUseCase.StorePage(emptyList(), 0, 0, 20))
            mvc.perform(get("/api/v1/place/markets/search").param("q", "  떡 \t집  "))
                .andExpect(status().isOk).andExpect(jsonPath("$.data.query").value("떡집"))
                .andExpect(jsonPath("$.data.stores.page").value(0)).andExpect(jsonPath("$.data.stores.size").value(20))
        }
        Then("잘못된 언어·길이·페이지·크기를 거부한다") {
            listOf("lang" to "ja", "q" to "가".repeat(51), "page" to "-1", "size" to "0", "size" to "51").forEach { (key, value) ->
                mvc.perform(get("/api/v1/place/markets/search").param(key, value)).andExpect(status().isBadRequest)
            }
        }
        Then("최대 검색어와 크기는 허용한다") {
            every { port.search("가".repeat(50), "en", 0, 50) } returns SearchMarketsUseCase.Result("가".repeat(50), emptyList(),
                SearchMarketsUseCase.StorePage(emptyList(), 0, 0, 50))
            mvc.perform(get("/api/v1/place/markets/search").param("q", "가".repeat(50)).param("size", "50").param("lang", "en"))
                .andExpect(status().isOk)
        }
        Then("지도 대상 content ID와 공개 1시간 캐시 헤더를 반환한다") {
            every { port.contentIds() } returns listOf("c1", "c2")
            mvc.perform(get("/api/v1/place/markets/content-ids"))
                .andExpect(status().isOk).andExpect(jsonPath("$.data[0]").value("c1"))
                .andExpect(header().string("Cache-Control", "max-age=3600, public"))
        }
    }
})
