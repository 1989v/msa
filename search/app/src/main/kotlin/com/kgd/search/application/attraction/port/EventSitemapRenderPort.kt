package com.kgd.search.application.attraction.port

import com.kgd.search.domain.attraction.model.EventSitemapEntry

/** 행사 sitemap XML. 받은 항목을 거르지 않고 그대로 싣는다 — 등재 판정은 호출자가 끝낸다. */
interface EventSitemapRenderPort {
    fun eventSitemap(entries: List<EventSitemapEntry>): String
}
