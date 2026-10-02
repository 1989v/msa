package com.kgd.search.infrastructure.render

import com.kgd.search.application.attraction.port.EventSitemapRenderPort
import com.kgd.search.domain.attraction.model.EventSitemapEntry
import com.kgd.search.infrastructure.config.AttractionRenderProperties
import org.springframework.stereotype.Component

/**
 * 행사 sitemap urlset. 주소 모양은 정적 sitemap(`prerender-seo.mjs` `placeDetailSitemapEntries`)과 같다 —
 * 국문 `/attractions/{id}` · 영문 `/en/attractions/{id}`, 호스트는 요청이 아니라 설정의 origin.
 *
 * id 는 숫자만 싣는다(문서 id 는 place PK). `lastmod` 는 원천 수정일의 날짜 부분(W3C `YYYY-MM-DD`)이고 없으면 생략한다.
 */
@Component
class EventSitemapRenderer(properties: AttractionRenderProperties) : EventSitemapRenderPort {
    private val origin = properties.origin.trimEnd('/')

    override fun eventSitemap(entries: List<EventSitemapEntry>): String = buildString {
        append("""<?xml version="1.0" encoding="UTF-8"?>""").append('\n')
        append("""<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">""").append('\n')
        entries.filter { ID.matches(it.id) }.forEach { entry ->
            val path = (if (entry.lang == EN) "/en" else "") + "/attractions/${entry.id}"
            append("  <url>\n")
            append("    <loc>").append(escapeXml(origin + path)).append("</loc>\n")
            entry.modifiedAt?.let { append("    <lastmod>").append(it.toLocalDate()).append("</lastmod>\n") }
            append("  </url>\n")
        }
        append("</urlset>\n")
    }

    private fun escapeXml(value: String): String = value
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\"", "&quot;")
        .replace("'", "&apos;")

    private companion object {
        const val EN = "en"
        val ID = Regex("\\d{1,12}")
    }
}
