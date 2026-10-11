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
 * 서버 렌더 가까운 역·정류장 ≡ 화면 가까운 역·정류장.
 *
 * 기대값은 `portal-fe/src/pages/place/__tests__/accessLinesGolden.test.ts` 가 화면의 `accessView` **출력**으로 쓴 골든이다.
 * 같은 입력(색인 문서 `_source`)을 [AttractionSearchDocument] 로 읽어 앱의 읽기 경로를 타고 렌더한 뒤,
 * **렌더된 HTML 의** `access` 절에서 줄·안내·출처를 뽑아 비교한다. 절이 없으면 골든 출력이 null 이어야 한다.
 */
class AttractionAccessParityTest : BehaviorSpec({

    val mapper = ObjectMapper()
    // 운영 OpenSearch 클라이언트와 같은 설정
    val indexMapper = jacksonMapperBuilder()
        .disable(DateTimeFeature.WRITE_DATES_AS_TIMESTAMPS)
        .disable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
        .build()
    val renderer = AttractionPageRenderer(AttractionRenderProperties(), mapper)
    val golden = mapper.readTree(
        AttractionAccessParityTest::class.java.getResourceAsStream("/render/access-golden.json")!!.readAllBytes(),
    )

    fun JsonNode.items(): List<JsonNode> = (0 until size()).map { get(it) }
    fun documentOf(input: JsonNode) = indexMapper.treeToValue(input, AttractionSearchDocument::class.java).toDomain()

    /** 렌더된 절 → 화면 `accessView` 와 같은 모양(items · note · source). 절이 없으면 null */
    fun accessOf(html: String): Map<String, Any?>? {
        val block = Regex("""<section data-place-section="access">([\s\S]*?)</section>""").find(html)?.groupValues?.get(1)
            ?: return null
        fun p(kind: String) = Regex("""<p data-access="$kind">([\s\S]*?)</p>""").find(block)?.groupValues?.get(1)?.let(::decodeHtml)
        return mapOf(
            "items" to Regex("""<li>([\s\S]*?)</li>""").findAll(block).map { decodeHtml(it.groupValues[1]) }.toList(),
            "note" to p("note"),
            "source" to p("source"),
        )
    }

    fun expected(output: JsonNode): Map<String, Any?>? =
        if (output.isNull) {
            null
        } else {
            mapOf(
                "items" to output["items"].items().map { it.asString() },
                "note" to output["note"].takeUnless { it.isNull }?.asString(),
                "source" to output["source"].asString(),
            )
        }

    given("accessView 출력에서 만든 골든") {
        val cases = golden["cases"].items()

        then("km 경계·미연계·절 없음 사례가 국·영으로 있다") {
            cases shouldHaveAtLeastSize 12
        }

        cases.forEach { case ->
            `when`(case["name"].asString()) {
                then("줄·안내·출처가 같다 — 화면이 절을 숨기면 서버도 없다") {
                    val html = renderer.attractionPage(SHELL, documentOf(case["input"]), TODAY)
                    accessOf(html) shouldBe expected(case["output"])
                }
            }
        }
    }
})
