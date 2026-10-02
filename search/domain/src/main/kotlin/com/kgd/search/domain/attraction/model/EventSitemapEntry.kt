package com.kgd.search.domain.attraction.model

import java.time.LocalDateTime

/**
 * 행사 sitemap 의 후보 한 건 — 등재 판정(개요 · 상태 · 만료)과 URL · `lastmod` 에 필요한 값만 담는다.
 *
 * @property hasOverview 개요가 빈 문자열이 아니다 — 서버 렌더의 noindex 판정과 같은 기준
 * @property modifiedAt 원천 수정일. 없으면 `lastmod` 를 생략한다
 */
data class EventSitemapEntry(
    val id: String,
    val lang: String,
    val period: EventPeriod?,
    val hasOverview: Boolean,
    val modifiedAt: LocalDateTime?,
)
