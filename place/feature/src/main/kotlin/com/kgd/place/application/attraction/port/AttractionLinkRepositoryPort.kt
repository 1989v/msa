package com.kgd.place.application.attraction.port

import com.kgd.place.domain.attraction.model.AttractionLink
import com.kgd.place.domain.attraction.model.AttractionLinkRequest
import com.kgd.place.domain.attraction.model.AttractionLinkSource
import com.kgd.place.domain.attraction.model.VideoDetails
import java.time.LocalDateTime

interface AttractionLinkRepositoryPort {
    fun findLinks(attractionId: Long): List<AttractionLink>

    /** (관광지, 소스) 단위 전체 교체 — 원천에서 사라진 항목이 남지 않게 한다. */
    fun replaceLinks(attractionId: Long, source: AttractionLinkSource, links: List<AttractionLink>)

    fun findRequest(attractionId: Long, source: AttractionLinkSource): AttractionLinkRequest?

    fun saveRequest(request: AttractionLinkRequest): AttractionLinkRequest

    fun findDueRequests(source: AttractionLinkSource, now: LocalDateTime, limit: Int): List<AttractionLinkRequest>

    /** 길이·비율을 아직 모르는 영상 id(중복 없이). */
    fun findVideoIdsMissingDetails(limit: Int): List<String>

    /** 같은 영상이 붙은 행 전부에 길이·비율을 채운다. 반환은 바뀐 행 수. */
    fun updateVideoDetails(details: List<VideoDetails>): Int

    /** 그날 소진한 외부 API 호출 수 (성공·빈결과·실패 모두 포함). */
    fun countAttemptsSince(source: AttractionLinkSource, since: LocalDateTime): Long
}
