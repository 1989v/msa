package com.kgd.search.infrastructure.render

import com.kgd.search.infrastructure.config.AttractionRenderProperties
import com.kgd.search.infrastructure.render.AttractionPageFixtures.SHELL
import com.kgd.search.infrastructure.render.AttractionPageFixtures.TODAY
import com.kgd.search.infrastructure.render.AttractionPageFixtures.decodeHtml
import com.kgd.search.infrastructure.render.AttractionPageFixtures.doc
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import tools.jackson.databind.ObjectMapper

/**
 * 서버 렌더 바닥글 ≡ 프리렌더 바닥글.
 *
 * 기대값은 `portal-fe/src/seo/__tests__/footerLinksGolden.test.ts` 가 프리렌더 `siteFooter()` 의 **출력**에서
 * 뽑아 쓴 골든이다. 이 테스트는 렌더러 기본 설정(origin = place 호스트)으로 상세를 그려 **렌더된 HTML 의**
 * `<footer>` 안 링크를 같은 규칙으로 뽑아 비교한다. CI 가 골든을 다시 만들어 `git diff` 로 막으므로,
 * 프리렌더만 바뀌면 거기서, 서버만 바뀌면 여기서 빨개진다.
 */
class FooterLinksParityTest : BehaviorSpec({

    val mapper = ObjectMapper()
    val renderer = AttractionPageRenderer(AttractionRenderProperties(), mapper)

    fun footerLinks(html: String): List<Pair<String, String>> {
        val footer = Regex("""<footer>([\s\S]*?)</footer>""").find(html)?.groupValues?.get(1).orEmpty()
        return Regex("""<a href="([^"]*)">([\s\S]*?)</a>""").findAll(footer)
            .map { decodeHtml(it.groupValues[1]) to decodeHtml(it.groupValues[2]) }.toList()
    }

    given("siteFooter() 출력에서 만든 골든") {
        val golden = mapper.readTree(
            FooterLinksParityTest::class.java.getResourceAsStream("/render/footer-links-golden.json")!!.readAllBytes(),
        )
        val expected = (0 until golden.size()).map { golden[it]["href"].asString() to golden[it]["label"].asString() }

        then("골든은 호스트 여섯 + 신뢰 넷") {
            expected shouldHaveSize 10
        }

        then("국·영 상세의 바닥글 링크가 골든과 순서째 같다") {
            listOf(doc(), doc(id = "6001", lang = "en")).forEach { d ->
                footerLinks(renderer.attractionPage(SHELL, d, TODAY)) shouldBe expected
            }
        }
    }
})
