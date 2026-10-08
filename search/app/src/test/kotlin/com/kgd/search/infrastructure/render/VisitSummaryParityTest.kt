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
 * 서버 렌더 방문 요약 ≡ 화면 방문 요약.
 *
 * 기대값은 `portal-fe/src/pages/place/__tests__/visitSummaryGolden.test.ts` 가 화면의 `visitSummary` **출력**으로 쓴 골든이다.
 * 같은 입력(색인 문서 `_source`)을 [AttractionSearchDocument] 로 역직렬화해 앱의 읽기 경로를 그대로 타고 렌더한 뒤,
 * **렌더된 HTML 의** `visit-summary` `<dl>` 과 `visit-badges` 줄을 뽑아 평문으로 되돌려 비교한다.
 * CI 가 골든을 다시 만들어 `git diff` 로 막으므로, 화면 문구만 바뀌면 거기서, 서버만 바뀌면 여기서 빨개진다.
 */
class VisitSummaryParityTest : BehaviorSpec({

    val mapper = ObjectMapper()
    // 운영 OpenSearch 클라이언트와 같은 설정
    val indexMapper = jacksonMapperBuilder()
        .disable(DateTimeFeature.WRITE_DATES_AS_TIMESTAMPS)
        .disable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
        .build()
    val renderer = AttractionPageRenderer(AttractionRenderProperties(), mapper)
    val golden = mapper.readTree(
        VisitSummaryParityTest::class.java.getResourceAsStream("/render/visit-summary-golden.json")!!.readAllBytes(),
    )

    fun JsonNode.items(): List<JsonNode> = (0 until size()).map { get(it) }
    fun documentOf(input: JsonNode) = indexMapper.treeToValue(input, AttractionSearchDocument::class.java).toDomain()

    fun summaryRows(html: String): List<Pair<String, String>> {
        val dl = Regex("""<dl data-place-section="visit-summary">([\s\S]*?)</dl>""").find(html)?.groupValues?.get(1)
            ?: error("방문 요약 <dl> 이 없다")
        return Regex("""<dt>([\s\S]*?)</dt><dd>([\s\S]*?)</dd>""").findAll(dl)
            .map { decodeHtml(it.groupValues[1]) to decodeHtml(it.groupValues[2]) }.toList()
    }

    fun badgeLine(html: String): String? =
        Regex("""<p data-place-section="visit-badges">([\s\S]*?)</p>""").find(html)?.groupValues?.get(1)?.let(::decodeHtml)

    given("visitSummary 출력에서 만든 골든") {
        val cases = golden["cases"].items()

        then("요금 원천 셋 × 출처 × 국·영 행렬과 해석·원문 조합이 있다") {
            cases shouldHaveAtLeastSize 18
        }

        cases.forEach { case ->
            `when`(case["name"].asString()) {
                val html = renderer.attractionPage(SHELL, documentOf(case["input"]), TODAY)
                val output = case["output"]

                then("칸 이름·값이 순서째 같다") {
                    summaryRows(html) shouldBe output["rows"].items().map { it["label"].asString() to it["value"].asString() }
                }
                then("배지 줄이 같다 — 없으면 절도 없다") {
                    badgeLine(html) shouldBe output["badgeLine"].takeUnless { it.isNull }?.asString()
                }
            }
        }
    }
})
