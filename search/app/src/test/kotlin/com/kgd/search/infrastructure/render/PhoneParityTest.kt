package com.kgd.search.infrastructure.render

import com.kgd.search.domain.attraction.model.AttractionSeoText
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
 * 서버 렌더 전화 항목 ≡ 화면 전화 항목.
 *
 * 기대값은 `portal-fe/src/seo/__tests__/phoneGolden.test.ts` 가 copy.mjs `attractionPhone` 의 **출력**으로 쓴 골든이다.
 * 같은 원문을 [AttractionSeoText.attractionPhone] 에 넣어 비교하고, 렌더된 `actions` 절의 링크 한 건을 함께 대조한다.
 */
class PhoneParityTest : BehaviorSpec({

    val mapper = ObjectMapper()
    val renderer = AttractionPageRenderer(AttractionRenderProperties(), mapper)
    val golden = mapper.readTree(
        PhoneParityTest::class.java.getResourceAsStream("/render/phone-golden.json")!!.readAllBytes(),
    )

    fun JsonNode.text(field: String): String? = get(field)?.takeUnless { it.isNull }?.asString()
    fun expectedOf(output: JsonNode): AttractionSeoText.Phone? =
        output.takeUnless { it.isNull }?.let { AttractionSeoText.Phone(it.text("text")!!, it.text("href")) }

    given("attractionPhone 출력에서 만든 골든") {
        val cases = (0 until golden["cases"].size()).map { golden["cases"][it] }

        then("SR 의 tel: 여덟 사례 + 한글 뒤 대표번호 + 빈 원문") {
            cases shouldHaveAtLeastSize 10
        }

        cases.forEach { case ->
            then(case.text("name")!!) {
                AttractionSeoText.attractionPhone(case.text("input")) shouldBe expectedOf(case["output"])
            }
        }

        then("렌더된 행동 줄의 tel: 링크가 골든 href 와 같다") {
            val case = cases.first { it.text("name") == "international" }
            val html = renderer.attractionPage(SHELL, doc().copy(infoCenter = case.text("input"), tel = null), TODAY)
            val href = Regex("""<p data-place-section="actions"><a href="([^"]*)">""").find(html)?.groupValues?.get(1)
            href?.let(::decodeHtml) shouldBe case["output"].text("href")
        }
    }
})
