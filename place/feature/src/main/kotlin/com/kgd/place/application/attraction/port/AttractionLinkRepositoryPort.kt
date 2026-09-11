package com.kgd.place.application.attraction.port

import com.kgd.place.domain.attraction.model.AttractionLink
import com.kgd.place.domain.attraction.model.AttractionLinkRequest
import com.kgd.place.domain.attraction.model.AttractionLinkSource
import java.time.LocalDateTime

interface AttractionLinkRepositoryPort {
    fun findLinks(attractionId: Long): List<AttractionLink>

    /** (관광지, 소스) 단위 전체 교체 — 원천에서 사라진 항목이 남지 않게 한다. */
    fun replaceLinks(attractionId: Long, source: AttractionLinkSource, links: List<AttractionLink>)

    fun findRequest(attractionId: Long, source: AttractionLinkSource): AttractionLinkRequest?

    fun saveRequest(request: AttractionLinkRequest): AttractionLinkRequest

    fun findDueRequests(source: AttractionLinkSource, now: LocalDateTime, limit: Int): List<AttractionLinkRequest>

    /** 그날 소진한 외부 API 호출 수 (성공·빈결과·실패 모두 포함). */
    fun countAttemptsSince(source: AttractionLinkSource, since: LocalDateTime): Long
}
