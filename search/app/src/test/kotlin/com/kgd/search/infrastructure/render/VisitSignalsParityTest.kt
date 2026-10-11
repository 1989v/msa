package com.kgd.search.infrastructure.render

import com.kgd.search.infrastructure.config.AttractionRenderProperties
import com.kgd.search.infrastructure.opensearch.AttractionSearchDocument
import com.kgd.search.infrastructure.render.AttractionPageFixtures.SHELL
import com.kgd.search.infrastructure.render.AttractionPageFixtures.TODAY
import com.kgd.search.infrastructure.render.AttractionPageFixtures.decodeHtml
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldHaveAtLeastSize
import io.kotest.matchers.shouldBe
import tools.jackson.databind.DeserializationFeature
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper
import tools.jackson.databind.cfg.DateTimeFeature
import tools.jackson.module.kotlin.jacksonMapperBuilder

/**
 * 서버 렌더 이 사이트 근거 줄 ≡ 화면 근거 줄.
 *
 * 기대값은 `portal-fe/src/pages/place/__tests__/visitSignalsGolden.test.ts` 가 화면의 `siteSignalSentences` **출력**으로 쓴 골든이다.
 * 같은 입력(색인 문서 `_source`)을 [AttractionSearchDocument] 로 읽어 앱의 읽기 경로를 타고 렌더한 뒤,
 * **렌더된 HTML 의** `visit-signals` 절에서 줄을 뽑아 비교한다.
 */
class VisitSignalsParityTest : BehaviorSpec({

    val mapper = ObjectMapper()
    // 운영 OpenSearch 클라이언트와 같은 설정
    val indexMapper = jacksonMapperBuilder()
        .disable(DateTimeFeature.WRITE_DATES_AS_TIMESTAMPS)
        .disable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
        .build()
    val renderer = AttractionPageRenderer(AttractionRenderProperties(), mapper)
    val golden = mapper.readTree(
        VisitSignalsParityTest::class.java.getResourceAsStream("/render/visit-signals-golden.json")!!.readAllBytes(),
    )

    fun JsonNode.items(): List<JsonNode> = (0 until size()).map { get(it) }
    fun documentOf(input: JsonNode) = indexMapper.treeToValue(input, AttractionSearchDocument::class.java).toDomain()

    fun signalLines(html: String): List<String> {
        val block = Regex("""<div data-place-section="visit-signals">([\s\S]*?)</div>""").find(html)?.groupValues?.get(1)
            ?: return emptyList()
        return Regex("""<p>([\s\S]*?)</p>""").findAll(block).map { decodeHtml(it.groupValues[1]) }.toList()
    }

    given("siteSignalSentences 출력에서 만든 골든") {
        val cases = golden["cases"].items()

        then("경계·기준일·유형 사례가 국·영으로 있다") {
            cases shouldHaveAtLeastSize 12
        }

        cases.forEach { case ->
            `when`(case["name"].asString()) {
                then("근거 줄이 순서째 같다 — 없으면 절도 없다") {
                    val html = renderer.attractionPage(SHELL, documentOf(case["input"]), TODAY)
                    signalLines(html) shouldBe case["output"].items().map { it.asString() }
                }
            }
        }
    }
})
