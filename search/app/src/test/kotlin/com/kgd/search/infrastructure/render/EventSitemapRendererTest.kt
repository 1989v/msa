package com.kgd.search.infrastructure.render

import com.kgd.search.domain.attraction.model.EventPeriod
import com.kgd.search.domain.attraction.model.EventSitemapEntry
import com.kgd.search.infrastructure.config.AttractionRenderProperties
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import org.w3c.dom.Element
import java.time.LocalDate
import java.time.LocalDateTime
import javax.xml.parsers.DocumentBuilderFactory

/** 렌더러가 내놓은 XML 을 파서로 읽어 `<url>` 의 loc·lastmod 를 본다. */
class EventSitemapRendererTest : BehaviorSpec({

    data class Url(val loc: String, val lastmod: String?)

    fun parse(xml: String): Pair<String, List<Url>> {
        val factory = DocumentBuilderFactory.newInstance().apply { isNamespaceAware = true }
        val root = factory.newDocumentBuilder().parse(xml.byteInputStream()).documentElement
        val urls = root.getElementsByTagNameNS(NS, "url").let { list ->
            (0 until list.length).map { i ->
                val url = list.item(i) as Element
                fun text(tag: String) = url.getElementsByTagNameNS(NS, tag).item(0)?.textContent
                Url(text("loc")!!, text("lastmod"))
            }
        }
        return "${root.namespaceURI}#${root.localName}" to urls
    }

    val period = EventPeriod(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 3))
    fun entry(id: String, lang: String = "ko", modifiedAt: LocalDateTime? = null) =
        EventSitemapEntry(id = id, lang = lang, period = period, hasOverview = true, modifiedAt = modifiedAt)

    given("국문·영문 행사") {
        val xml = EventSitemapRenderer(AttractionRenderProperties()).eventSitemap(
            listOf(entry("7001", modifiedAt = LocalDateTime.of(2026, 9, 30, 23, 59, 59)), entry("7002", lang = "en")),
        )

        then("sitemap 0.9 urlset 이고 주소는 정적 sitemap 과 같은 모양이다") {
            val (root, urls) = parse(xml)
            root shouldBe "$NS#urlset"
            urls.map { it.loc } shouldBe listOf(
                "https://place.1989v.com/attractions/7001",
                "https://place.1989v.com/en/attractions/7002",
            )
        }

        then("lastmod 는 원천 수정일의 W3C 날짜이고, 수정일이 없으면 생략한다") {
            parse(xml).second.map { it.lastmod } shouldBe listOf("2026-09-30", null)
        }
    }

    given("XML 특수문자가 든 origin · 숫자가 아닌 id") {
        val xml = EventSitemapRenderer(AttractionRenderProperties(origin = "https://p.example/a&b<c>'\"/")).eventSitemap(
            listOf(entry("7003"), entry("7004<x>")),
        )

        then("이스케이프되어 파서가 원래 문자열로 읽고, 숫자가 아닌 id 는 싣지 않는다") {
            parse(xml).second.map { it.loc } shouldBe listOf("https://p.example/a&b<c>'\"/attractions/7003")
        }
    }

    given("후보 0건") {
        then("url 없는 유효한 urlset 이다") {
            parse(EventSitemapRenderer(AttractionRenderProperties()).eventSitemap(emptyList())).second shouldBe emptyList()
        }
    }
}) {
    private companion object {
        const val NS = "http://www.sitemaps.org/schemas/sitemap/0.9"
    }
}
