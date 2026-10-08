package com.kgd.search.infrastructure.render

import com.kgd.search.infrastructure.config.AttractionRenderProperties
import com.kgd.search.infrastructure.render.AttractionPageFixtures.SHELL
import com.kgd.search.infrastructure.render.AttractionPageFixtures.TODAY
import com.kgd.search.infrastructure.render.AttractionPageFixtures.decodeHtml
import com.kgd.search.infrastructure.render.AttractionPageFixtures.doc
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldHaveAtLeastSize
import io.kotest.matchers.shouldBe
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper

/**
 * 서버 렌더 hreflang ≡ 화면 hreflang.
 *
 * 기대값은 `portal-fe/src/seo/__tests__/attractionHreflangGolden.test.ts` 가 copy.mjs `attractionHreflangAlternates` 의
 * **출력**으로 쓴 골든이다. 같은 입력(문서 언어 · id · 짝 id)을 렌더하고 `<link rel="alternate" hreflang>` 줄을 뽑아 비교한다.
 */
class AttractionHreflangParityTest : BehaviorSpec({

    val mapper = ObjectMapper()
    val renderer = AttractionPageRenderer(AttractionRenderProperties(), mapper)
    val golden = mapper.readTree(
        AttractionHreflangParityTest::class.java.getResourceAsStream("/render/attraction-hreflang-golden.json")!!.readAllBytes(),
    )
    val link = Regex("""<link rel="alternate" hreflang="([^"]*)" href="([^"]*)" data-seo-multi />""")

    fun JsonNode.text(field: String): String = get(field).asString()

    given("attractionHreflangAlternates 출력에서 만든 골든") {
        val cases = (0 until golden["cases"].size()).map { golden["cases"][it] }

        then("국문 문서 · 영문 문서 두 사례") {
            cases shouldHaveAtLeastSize 2
        }

        cases.forEach { case ->
            then(case.text("name")) {
                val d = doc(id = case.text("id"), lang = case.text("docLang")).copy(alternateId = case.text("alternateId"))
                val html = renderer.attractionPage(SHELL, d, TODAY)
                val rendered = link.findAll(html).map { decodeHtml(it.groupValues[1]) to decodeHtml(it.groupValues[2]) }.toList()
                val expected = (0 until case["output"].size()).map { case["output"][it] }
                    .map { it.text("hreflang") to it.text("href") }
                rendered shouldBe expected
            }
        }
    }
})
