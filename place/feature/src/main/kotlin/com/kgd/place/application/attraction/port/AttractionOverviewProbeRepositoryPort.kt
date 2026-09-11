package com.kgd.place.application.attraction.port

import com.kgd.place.domain.attraction.model.AttractionOverviewProbe

interface AttractionOverviewProbeRepositoryPort {
    /** (contentId, lang) 자연키 기준 멱등 upsert — 이미 있으면 확인 시각만 갱신. */
    fun recordAll(probes: List<AttractionOverviewProbe>): Int

    /** lang 미지정 시 전체. 수집기가 제외 목록으로 쓴다. */
    fun findAll(lang: String?): List<AttractionOverviewProbe>
}
