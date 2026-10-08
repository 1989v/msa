package com.kgd.search.infrastructure.render

import com.kgd.search.application.attraction.port.AttractionFeedRenderPort
import com.kgd.search.domain.attraction.model.AttractionFeedEntry
import com.kgd.search.domain.attraction.model.AttractionSeoText
import com.kgd.search.infrastructure.config.AttractionRenderProperties
import org.springframework.stereotype.Component
import java.time.LocalDateTime
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

/**
 * 최근 갱신 RSS 2.0. 주소 모양은 상세 canonical 과 같다 — 국문 `/attractions/{id}` · 영문 `/en/attractions/{id}`,
 * 호스트는 요청이 아니라 설정의 origin. id 는 숫자만 싣는다(문서 id 는 place PK).
 *
 * 텍스트는 [AttractionSeoText.sourceText](목록 요약은 [AttractionSeoText.summary]) → XML 1.0 금지 문자 제거 → XML 이스케이프
 * 순서로 고정한다. 원천 개요에 제어문자가 섞여 오면 이스케이프만으로는 문서가 깨져 구독기가 피드 전체를 버린다.
 * 피드 제목은 상세 `<head>` 의 피드 링크 제목과 같다(copy.mjs `placeFeed`).
 */
@Component
class AttractionFeedRenderer(properties: AttractionRenderProperties) : AttractionFeedRenderPort {
    private val origin = properties.origin.trimEnd('/')

    override fun feed(lang: String, entries: List<AttractionFeedEntry>): String = buildString {
        val en = lang == EN
        val items = entries.filter { ID.matches(it.id) }
        append("""<?xml version="1.0" encoding="UTF-8"?>""").append('\n')
        append("""<rss version="2.0">""").append('\n')
        append("<channel>\n")
        element("title", feedTitle(lang))
        element("link", origin + if (en) "/en" else "/")
        element("description", if (en) DESCRIPTION_EN else DESCRIPTION_KO)
        element("language", if (en) EN else KO)
        items.firstOrNull()?.let { element("lastBuildDate", rfc1123(it.contentUpdatedAt)) }
        items.forEach { entry ->
            val url = origin + (if (en) "/en" else "") + "/attractions/${entry.id}"
            append("  <item>\n")
            element("title", AttractionSeoText.sourceText(entry.title), indent = "    ")
            element("link", url, indent = "    ")
            append("""    <guid isPermaLink="true">""").append(xmlText(url)).append("</guid>\n")
            element("pubDate", rfc1123(entry.contentUpdatedAt), indent = "    ")
            AttractionSeoText.summary(entry.overview)?.let { element("description", it, indent = "    ") }
            append("  </item>\n")
        }
        append("</channel>\n")
        append("</rss>\n")
    }

    private fun StringBuilder.element(name: String, text: String, indent: String = "  ") {
        append(indent).append('<').append(name).append('>').append(xmlText(text)).append("</").append(name).append(">\n")
    }

    /** 금지 문자 제거 → 이스케이프. 입력은 이미 평문화를 거친 값이다 */
    private fun xmlText(value: String): String = value
        .replace(XML_FORBIDDEN, "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\"", "&quot;")
        .replace("'", "&apos;")

    /** 색인 시각은 KST 벽시계 값이다 — 오프셋만 붙인다 */
    private fun rfc1123(at: LocalDateTime): String = at.atOffset(KST).format(DateTimeFormatter.RFC_1123_DATE_TIME)

    companion object {
        private const val KO = "ko"
        private const val EN = "en"
        private val KST: ZoneOffset = ZoneOffset.ofHours(9)
        private val ID = Regex("\\d{1,12}")

        /** XML 1.0 이 허용하지 않는 문자 — U+0000–U+0008, U+000B, U+000C, U+000E–U+001F, U+FFFE, U+FFFF */
        private val XML_FORBIDDEN = Regex("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\uFFFE\\uFFFF]")

        private const val DESCRIPTION_KO = "한국관광공사 공식 데이터에서 내용이 최근 바뀐 관광지 50곳입니다."
        private const val DESCRIPTION_EN = "The 50 attractions whose details changed most recently, from official Korea Tourism Organization data."

        /** copy.mjs `placeFeed` 의 제목과 같은 값 — 상세 `<head>` 피드 링크와 channel 제목이 함께 쓴다 */
        fun feedTitle(lang: String): String =
            if (lang == EN) "K-Tour — Recently Updated Attractions" else "K-관광 — 최근 바뀐 관광지"

        /** copy.mjs `placeFeed` 의 주소 경로 */
        fun feedPath(lang: String): String = if (lang == EN) "/en/feed.xml" else "/feed.xml"
    }
}
