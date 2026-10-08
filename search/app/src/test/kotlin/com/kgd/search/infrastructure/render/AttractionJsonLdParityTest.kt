package com.kgd.search.infrastructure.render

import com.kgd.search.domain.attraction.model.AttractionSeoText
import com.kgd.search.domain.attraction.model.EventSchedule
import com.kgd.search.domain.attraction.model.EventStatus
import com.kgd.search.infrastructure.config.AttractionRenderProperties
import com.kgd.search.infrastructure.opensearch.AttractionSearchDocument
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContainAll
import io.kotest.matchers.collections.shouldHaveAtLeastSize
import io.kotest.matchers.shouldBe
import tools.jackson.databind.DeserializationFeature
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper
import tools.jackson.databind.cfg.DateTimeFeature
import tools.jackson.module.kotlin.jacksonMapperBuilder
import java.math.BigDecimal
import java.time.LocalDate

/**
 * 서버 렌더 JSON-LD ≡ 화면(useSeo) JSON-LD.
 *
 * 기대값은 `portal-fe/src/seo/__tests__/attractionJsonLdGolden.test.ts` 가 **copy.mjs 의 실제 함수**로
 * 만든 픽스처다. 이 테스트는 같은 입력(색인 문서 `_source`)을 [AttractionSearchDocument] 로 **역직렬화**해
 * 도메인으로 바꾸고(앱이 OpenSearch 에서 읽는 경로 그대로 — 필드를 손으로 옮기지 않는다) 렌더하며,
 * **렌더된 HTML 에서** `data-seo-multi` 블록을 꺼내 비교한다. CI 가 픽스처를 다시 만들어
 * `git diff --exit-code` 로 막으므로, copy.mjs 만 바뀌면 거기서, 서버만 바뀌면 여기서 빨개진다.
 */
class AttractionJsonLdParityTest : BehaviorSpec({

    val mapper = ObjectMapper()
    // 운영 OpenSearch 클라이언트와 같은 설정
    val indexMapper = jacksonMapperBuilder()
        .disable(DateTimeFeature.WRITE_DATES_AS_TIMESTAMPS)
        .disable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
        .build()
    val renderer = AttractionPageRenderer(AttractionRenderProperties(), mapper)
    val golden = mapper.readTree(
        AttractionJsonLdParityTest::class.java.getResourceAsStream("/render/jsonld-golden.json")!!.readAllBytes(),
    )
    val today = LocalDate.parse(golden["today"].asString())

    fun JsonNode.text(field: String): String? = get(field)?.takeUnless { it.isNull }?.asString()
    fun JsonNode.items(): List<JsonNode> = (0 until size()).map { get(it) }

    /** 픽스처 입력(색인 문서) → 색인 문서 객체 → 도메인 */
    fun documentOf(input: JsonNode) = indexMapper.treeToValue(input, AttractionSearchDocument::class.java).toDomain()

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

        then("주 구조화 데이터의 @type 이 새 유형 셋과 관광지를 모두 덮는다") {
            cases.map { it["jsonLd"][0]["@type"].asString() }.toSet() shouldContainAll
                setOf("Event", "LodgingBusiness", "TouristTrip", "TouristAttraction")
        }

        then("픽스처의 오늘 기준으로 진행 중인 행사와 끝난 행사가 각각 있다") {
            val statuses = cases.map { documentOf(it["input"]) }
                .filter { EventSchedule.isEvent(it.contentTypeId) }
                .map { EventSchedule.status(it.eventPeriod, today) }
            statuses shouldContainAll listOf(EventStatus.ONGOING, EventStatus.ENDED)
        }

        then("관광지 사진 license 는 공공누리 제1·3유형만 절대 주소로 — 골든과 별개로 값을 못박는다") {
            fun licenseOf(name: String): String? {
                val input = cases.first { it.text("name") == name }["input"]
                val image = serverJsonLd(renderer.attractionPage(AttractionPageFixtures.SHELL, documentOf(input), today))[0]["image"]
                image["@type"].asString() shouldBe "ImageObject"
                image["creditText"].asString() shouldBe "한국관광공사"
                return image.text("license")
            }
            licenseOf("ko-photo-type1-sigungu") shouldBe "https://www.kogl.or.kr/info/licenseType1.do"
            licenseOf("ko-photo-type3-no-sigungu") shouldBe "https://www.kogl.or.kr/info/licenseType3.do"
            licenseOf("en-photo-type2-sigungu") shouldBe null
            // copyrightDivCd 가 없는 문서
            licenseOf("ko-weekly-free") shouldBe null
        }

        cases.forEach { case ->
            `when`(case.text("name")!!) {
                then("서버가 렌더한 JSON-LD 가 구조적으로 같다") {
                    val html = renderer.attractionPage(AttractionPageFixtures.SHELL, documentOf(case["input"]), today)
                    serverJsonLd(html).map(::normalize) shouldBe case["jsonLd"].items().map(::normalize)
                }
                then("서버가 렌더한 제목·설명이 같다") {
                    val html = renderer.attractionPage(AttractionPageFixtures.SHELL, documentOf(case["input"]), today)
                    val meta = case["meta"]
                    Regex("<title>([^<]*)</title>").find(html)!!.groupValues[1] shouldBe
                        AttractionSeoText.escapeHtml(meta.text("title"))
                    Regex("""<meta name="description" content="([^"]*)" />""").find(html)!!.groupValues[1] shouldBe
                        AttractionSeoText.escapeHtml(meta.text("description"))
                }
            }
        }
    }
})
