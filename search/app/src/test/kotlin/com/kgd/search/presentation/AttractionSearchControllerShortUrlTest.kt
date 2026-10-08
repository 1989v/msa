package com.kgd.search.presentation

import com.kgd.common.shortlink.ShortCode
import com.kgd.common.shortlink.ShortLinkProperties
import com.kgd.common.shortlink.ShortLinks
import com.kgd.search.application.attraction.service.AttractionShortUrlService
import com.kgd.search.application.attraction.usecase.SearchAttractionUseCase
import com.kgd.search.application.attraction.usecase.SuggestAttractionUseCase
import com.kgd.search.presentation.search.controller.AttractionSearchController
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldStartWith
import io.mockk.every
import io.mockk.mockk
import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper

/**
 * 관광지 상세(`/api/search/attractions/{id}`) 응답의 `shortUrl`.
 *
 * 컨트롤러를 직접 만들고 실제 `ShortLinks` 를 붙인 뒤, 응답을 JSON 으로 직렬화해 본다 —
 * FE 가 읽는 것은 직렬화된 모양이라 필드가 한 단계 아래로 들어가도 여기서 드러난다.
 */
class AttractionSearchControllerShortUrlTest : BehaviorSpec({

    val json = JsonMapper.builder().findAndAddModules().build()

    fun controller(expose: Boolean, id: String = "4321"): AttractionSearchController {
        val search = mockk<SearchAttractionUseCase>()
        every { search.findById(id) } returns SearchAttractionUseCase.AttractionSearchResult(
            id = id, contentId = "126508", lang = "ko", title = "경복궁",
            latitude = 37.5788, longitude = 126.9770,
        )
        val shortUrl = AttractionShortUrlService(ShortLinks(ShortLinkProperties(expose = expose)))
        return AttractionSearchController(search, mockk<SuggestAttractionUseCase>(), shortUrl)
    }

    fun AttractionSearchController.detailJson(id: String = "4321"): JsonNode =
        json.readTree(json.writeValueAsString(findById(id))).get("data")

    fun JsonNode.hasNoShortUrl(): Boolean = path("shortUrl").let { it.isNull || it.isMissingNode }

    given("노출이 켜져 있으면") {
        val data = controller(expose = true).detailJson()

        then("shortUrl 이 apex `/p/` 로 시작하고 코드를 디코딩하면 그 관광지 id 다") {
            val shortUrl = data.get("shortUrl").asString()
            shortUrl shouldStartWith "https://1989v.com/p/"
            ShortCode.decode(shortUrl.removePrefix("https://1989v.com/p/")) shouldBe 4321L
        }

        then("기존 필드는 그대로 최상위에 있다 — 한 단계 아래로 감싸지 않는다") {
            data.get("id").asString() shouldBe "4321"
            data.get("title").asString() shouldBe "경복궁"
            data.has("attraction") shouldBe false
        }
    }

    given("노출이 꺼져 있으면") {
        then("shortUrl 은 null 이다") {
            controller(expose = false).detailJson().hasNoShortUrl() shouldBe true
        }
    }

    given("문서 id 가 숫자가 아니면") {
        then("코드를 만들 수 없어 shortUrl 은 null 이다") {
            controller(expose = true, id = "abc").detailJson("abc").hasNoShortUrl() shouldBe true
        }
    }
})
