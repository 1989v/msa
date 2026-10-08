package com.kgd.search.application.attraction.port

import com.kgd.search.domain.attraction.model.AttractionFeedEntry

/** 최근 갱신 RSS XML. 받은 항목을 받은 순서대로 싣는다 — 고르기·줄 세우기는 조회가 끝낸다. */
interface AttractionFeedRenderPort {
    fun feed(lang: String, entries: List<AttractionFeedEntry>): String
}
