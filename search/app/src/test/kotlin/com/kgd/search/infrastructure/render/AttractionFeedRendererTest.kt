package com.kgd.search.infrastructure.render

import com.kgd.search.application.attraction.service.AttractionFeedService
import com.kgd.search.application.attraction.usecase.RenderAttractionFeedUseCase
import com.kgd.search.domain.attraction.model.AttractionFeedEntry
import com.kgd.search.domain.attraction.port.AttractionSearchPort
import com.kgd.search.infrastructure.config.AttractionRenderProperties
import com.kgd.search.infrastructure.opensearch.AttractionSearchRequestSnapshots
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import io.kotest.matchers.types.shouldBeInstanceOf
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.w3c.dom.Document
import org.w3c.dom.Element
import tools.jackson.databind.ObjectMapper
import java.io.IOException
import java.time.LocalDateTime
import javax.xml.parsers.DocumentBuilderFactory

/**
 * 최근 갱신 RSS — 서비스 + 렌더러가 **내놓은 XML** 을 JDK 파서로 읽어 본다. 색인 포트만 대역이다.
 * 줄 세우기 · 상한 · 언어 · 시각 없는 문서 제외는 색인 질의가 하므로 어댑터가 **내는 요청 JSON** 으로 본다.
 */
class AttractionFeedRendererTest : BehaviorSpec({
    val searchPort = mockk<AttractionSearchPort>()
    val service = AttractionFeedService(searchPort, AttractionFeedRenderer(AttractionRenderProperties()))
    val json = ObjectMapper()

    fun entry(
        id: String,
        at: LocalDateTime = LocalDateTime.of(2026, 10, 8, 9, 10, 11),
        title: String = "경복궁",
        overview: String? = "조선 왕조의 법궁이다.",
        lang: String = "ko",
    ) = AttractionFeedEntry(id = id, lang = lang, title = title, overview = overview, contentUpdatedAt = at)

    fun xmlOf(lang: String): String {
        val feed = service.render(lang)
        feed.shouldBeInstanceOf<RenderAttractionFeedUseCase.Feed.Ok>()
        return feed.xml
    }

    /** 파싱이 곧 「유효한 XML」 판정이다 — 금지 문자나 깨진 이스케이프가 있으면 여기서 예외가 난다 */
    fun parse(xml: String): Document = DocumentBuilderFactory.newInstance().apply {
        setFeature("http://apache.org/xml/features/disallow-doctype-decl", true)
    }.newDocumentBuilder().parse(xml.byteInputStream(Charsets.UTF_8))

    fun Document.channel(): Element = getElementsByTagName("channel").item(0) as Element
    fun Element.child(name: String): String? =
        (0 until childNodes.length).map { childNodes.item(it) }.filterIsInstance<Element>().firstOrNull { it.tagName == name }?.textContent
    fun Document.items(): List<Element> =
        (0 until getElementsByTagName("item").length).map { getElementsByTagName("item").item(it) as Element }

    beforeTest { clearMocks(searchPort) }

    given("조회 — 어댑터가 내는 요청") {
        val (adapter, captured) = AttractionSearchRequestSnapshots.adapter()
        adapter.findRecentlyUpdated("en", 50)
        val sent = json.readTree(captured.main.single().toJsonString())
        val filters = sent["query"]["bool"]["filter"]

        then("해당 언어만 · 본문 변경 시각이 있는 문서만 묻는다") {
            filters.toList().mapNotNull { it["term"]?.get("lang")?.get("value")?.asString() } shouldBe listOf("en")
            filters.toList().mapNotNull { it["exists"]?.get("field")?.asString() } shouldBe listOf("contentUpdatedAt")
        }

        then("본문 변경 시각 내림차순, 같은 시각이면 숫자 id 오름차순 — keyword id 는 사전순이라 쓰지 않는다") {
            val sort = sent["sort"].toList().map { s -> s.properties().single().let { it.key to it.value["order"].asString() } }
            sort shouldBe listOf("contentUpdatedAt" to "desc", "idSort" to "asc")
        }

        then("50건만 받는다 · 본문 원문·벡터를 싣지 않는다") {
            sent["size"].asInt() shouldBe 50
            val includes = sent["_source"]["includes"].toList().map { it.asString() }
            ("embedding" in includes) shouldBe false
            ("introRaw" in includes) shouldBe false
        }
    }

    given("서비스가 포트에 넘기는 상한") {
        then("언어별 50건") {
            every { searchPort.findRecentlyUpdated("ko", 50) } returns emptyList()
            xmlOf("ko")
            verify(exactly = 1) { searchPort.findRecentlyUpdated("ko", 50) }
        }
    }

    given("항목이 있는 국문 피드") {
        val first = LocalDateTime.of(2026, 10, 8, 9, 10, 11)
        then("받은 순서 그대로 · channel 은 국문 허브 · lastBuildDate 는 첫 항목 시각") {
            every { searchPort.findRecentlyUpdated("ko", 50) } returns listOf(
                entry("30", at = first), entry("7", at = first), entry("100", at = first.minusDays(1)),
            )
            val doc = parse(xmlOf("ko"))
            val channel = doc.channel()
            channel.child("language") shouldBe "ko"
            channel.child("link") shouldBe "https://place.1989v.com/"
            channel.child("lastBuildDate") shouldBe "Thu, 8 Oct 2026 09:10:11 +0900"
            doc.items().map { it.child("link") } shouldBe listOf(
                "https://place.1989v.com/attractions/30",
                "https://place.1989v.com/attractions/7",
                "https://place.1989v.com/attractions/100",
            )
        }

        then("guid 는 isPermaLink=true 인 상세 canonical · pubDate 는 +0900 RFC 1123") {
            every { searchPort.findRecentlyUpdated("ko", 50) } returns listOf(entry("1001", at = LocalDateTime.of(2026, 1, 5, 23, 4, 5)))
            val item = parse(xmlOf("ko")).items().single()
            val guid = item.getElementsByTagName("guid").item(0) as Element
            guid.getAttribute("isPermaLink") shouldBe "true"
            guid.textContent shouldBe "https://place.1989v.com/attractions/1001"
            item.child("pubDate") shouldBe "Mon, 5 Jan 2026 23:04:05 +0900"
        }

        then("제목은 평문화한 이름, 요약은 목록 요약(평문 200자 + …)") {
            val long = "<p>" + "가".repeat(250) + "</p>"
            every { searchPort.findRecentlyUpdated("ko", 50) } returns listOf(entry("1", title = "<b>경복궁</b>", overview = long))
            val item = parse(xmlOf("ko")).items().single()
            item.child("title") shouldBe "경복궁"
            item.child("description") shouldBe "가".repeat(200) + "…"
        }

        then("개요가 없으면 description 을 내지 않는다") {
            every { searchPort.findRecentlyUpdated("ko", 50) } returns listOf(entry("1", overview = null))
            parse(xmlOf("ko")).items().single().getElementsByTagName("description").length shouldBe 0
        }
    }

    given("텍스트 안전성") {
        then("XML 1.0 금지 문자(U+0001 · U+FFFE 등)를 지워 파서를 통과한다") {
            val dirty = "경복\u0001궁￾\u000B\u001F￿"
            every { searchPort.findRecentlyUpdated("ko", 50) } returns listOf(entry("1", title = dirty, overview = "개요\u0000끝\u0008"))
            val xml = xmlOf("ko")
            val item = parse(xml).items().single()
            item.child("title") shouldBe "경복궁"
            item.child("description") shouldBe "개요끝"
        }

        then("& < > \" ' 를 이스케이프한다 — 원문 엔티티는 평문화 단계에서 풀린 뒤 다시 이스케이프된다") {
            every { searchPort.findRecentlyUpdated("ko", 50) } returns listOf(
                entry("1", title = "Tom &amp; Jerry's \"Cafe\" &lt;Hi&gt;"),
            )
            val xml = xmlOf("ko")
            xml shouldContain "<title>Tom &amp; Jerry&apos;s &quot;Cafe&quot; &lt;Hi&gt;</title>"
            parse(xml).items().single().child("title") shouldBe "Tom & Jerry's \"Cafe\" <Hi>"
        }

        then("숫자가 아닌 id 는 주소를 만들지 않는다") {
            every { searchPort.findRecentlyUpdated("ko", 50) } returns listOf(entry("1\"><x"), entry("2"))
            parse(xmlOf("ko")).items().map { it.child("link") } shouldBe listOf("https://place.1989v.com/attractions/2")
        }
    }

    given("영문 피드") {
        then("language en · 허브와 상세가 /en 경로") {
            every { searchPort.findRecentlyUpdated("en", 50) } returns listOf(entry("2001", lang = "en", title = "Gyeongbokgung Palace"))
            val doc = parse(xmlOf("en"))
            doc.channel().child("language") shouldBe "en"
            doc.channel().child("link") shouldBe "https://place.1989v.com/en"
            doc.items().single().child("link") shouldBe "https://place.1989v.com/en/attractions/2001"
        }
    }

    given("0건") {
        then("항목 없는 유효 channel — lastBuildDate 없음") {
            every { searchPort.findRecentlyUpdated("ko", 50) } returns emptyList()
            val xml = xmlOf("ko")
            val doc = parse(xml)
            doc.documentElement.tagName shouldBe "rss"
            doc.documentElement.getAttribute("version") shouldBe "2.0"
            doc.items().size shouldBe 0
            doc.channel().child("title") shouldBe "K-관광 — 최근 바뀐 관광지"
            xml shouldNotContain "lastBuildDate"
        }
    }

    given("조회 실패") {
        then("Unavailable — 빈 channel 을 내지 않는다") {
            every { searchPort.findRecentlyUpdated("ko", 50) } throws IOException("opensearch down")
            service.render("ko") shouldBe RenderAttractionFeedUseCase.Feed.Unavailable
        }
    }
})
