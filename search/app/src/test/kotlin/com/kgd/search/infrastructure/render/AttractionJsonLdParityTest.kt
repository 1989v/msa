package com.kgd.search.infrastructure.render

import com.kgd.search.infrastructure.config.AttractionRenderProperties
import com.kgd.search.infrastructure.opensearch.AttractionSearchDocument
import com.kgd.search.infrastructure.opensearch.GeoPoint
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldHaveAtLeastSize
import io.kotest.matchers.shouldBe
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper
import java.math.BigDecimal

/**
 * 서버 렌더 JSON-LD ≡ 화면(useSeo) JSON-LD.
 *
 * 기대값은 `portal-fe/src/seo/__tests__/attractionJsonLdGolden.test.ts` 가 **copy.mjs 의 실제 함수**로
 * 만든 픽스처다. 이 테스트는 같은 입력을 색인 문서 → 도메인(읽기 경로 그대로)으로 바꿔 렌더하고,
 * **렌더된 HTML 에서** `data-seo-multi` 블록을 꺼내 비교한다. CI 가 픽스처를 다시 만들어
 * `git diff --exit-code` 로 막으므로, copy.mjs 만 바뀌면 거기서, 서버만 바뀌면 여기서 빨개진다.
 */
class AttractionJsonLdParityTest : BehaviorSpec({

    val mapper = ObjectMapper()
    val renderer = AttractionPageRenderer(AttractionRenderProperties(), mapper)
    val golden = mapper.readTree(
        AttractionJsonLdParityTest::class.java.getResourceAsStream("/render/jsonld-golden.json")!!.readAllBytes(),
    )

    fun JsonNode.text(field: String): String? = get(field)?.takeUnless { it.isNull }?.asString()
    fun JsonNode.items(): List<JsonNode> = (0 until size()).map { get(it) }

    /** 픽스처 입력(색인 필드 이름) → 색인 문서 → 도메인. 앱이 OpenSearch 에서 읽는 경로와 같다. */
    fun documentOf(input: JsonNode) = AttractionSearchDocument(
        id = input.text("id")!!,
        contentId = input.text("contentId")!!,
        lang = input.text("lang")!!,
        title = input.text("title")!!,
        titleLocal = input.text("titleLocal"),
        location = GeoPoint(input["latitude"].asDouble(), input["longitude"].asDouble()),
        address = input.text("address"),
        ldongRegnCd = input.text("sidoCode"),
        category = input.text("category"),
        imageUrl = input.text("imageUrl"),
        tel = input.text("tel"),
        overview = input.text("overview"),
        sidoName = input.text("sidoName"),
        closureState = input.text("closureState"),
        closedWeekdays = input.get("closedWeekdays")?.takeUnless { it.isNull }?.items()?.map { it.asString() },
        attrAdmission = input.text("attrAdmission"),
    ).toDomain()

    /** 숫자 표기 차이(37 vs 37.0)만 지우고 나머지는 그대로 비교한다. */
    fun normalize(node: JsonNode): Any? = when {
        node.isObject -> node.properties().associate { (k, v) -> k to normalize(v) }
        node.isArray -> node.items().map { normalize(it) }
        node.isNumber -> BigDecimal(node.asString()).stripTrailingZeros()
        node.isNull -> null
        else -> node.asString()
    }

    fun serverJsonLd(html: String): List<JsonNode> =
        Regex("""<script type="application/ld\+json" data-seo-multi>([\s\S]*?)</script>""")
            .findAll(html).map { mapper.readTree(it.groupValues[1]) }.toList()

    given("copy.mjs 가 만든 골든 픽스처") {
        val cases = golden["cases"].items()

        then("픽스처에 해석됨·UNKNOWN·옛 문서 경우가 모두 있다") {
            cases shouldHaveAtLeastSize 5
        }

        cases.forEach { case ->
            `when`(case.text("name")!!) {
                then("서버가 렌더한 JSON-LD 가 구조적으로 같다") {
                    val html = renderer.attractionPage(AttractionPageFixtures.SHELL, documentOf(case["input"]))
                    serverJsonLd(html).map(::normalize) shouldBe case["jsonLd"].items().map(::normalize)
                }
            }
        }
    }
})
