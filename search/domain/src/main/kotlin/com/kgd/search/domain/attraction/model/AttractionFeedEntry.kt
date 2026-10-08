package com.kgd.search.domain.attraction.model

import java.time.LocalDateTime

/**
 * 최근 갱신 피드(RSS)의 항목 한 건 — 주소 · 제목 · 요약 · 갱신 시각에 필요한 값만 담는다.
 *
 * @property overview 원천 개요 원문(태그·엔티티 포함). 요약은 렌더가 만든다
 * @property contentUpdatedAt 본문이 바뀐 시각(KST). 값이 없는 문서는 조회가 처음부터 빼므로 여기서는 늘 있다
 */
data class AttractionFeedEntry(
    val id: String,
    val lang: String,
    val title: String,
    val overview: String?,
    val contentUpdatedAt: LocalDateTime,
)
