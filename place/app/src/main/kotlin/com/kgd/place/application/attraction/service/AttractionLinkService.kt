package com.kgd.place.application.attraction.service

import com.kgd.place.application.attraction.port.AttractionLinkRepositoryPort
import com.kgd.place.application.attraction.port.AttractionRepositoryPort
import com.kgd.place.application.attraction.usecase.CollectAttractionLinksUseCase
import com.kgd.place.application.attraction.usecase.GetAttractionLinksUseCase
import com.kgd.place.domain.attraction.exception.AttractionNotFoundException
import com.kgd.place.domain.attraction.model.AttractionDeepLinks
import com.kgd.place.domain.attraction.model.AttractionLink
import com.kgd.place.domain.attraction.model.AttractionLinkRequest
import com.kgd.place.domain.attraction.model.AttractionLinkSource
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import java.time.LocalDate
import java.time.LocalDateTime

private val log = KotlinLogging.logger {}

/**
 * 관광지 외부 링크 (ADR-0070) — 조회는 캐시+딥링크, 수집은 CronJob 이 큐를 비운다.
 */
@Service
class AttractionLinkService(
    private val attractionRepository: AttractionRepositoryPort,
    private val linkRepository: AttractionLinkRepositoryPort,
) : GetAttractionLinksUseCase, CollectAttractionLinksUseCase {

    override fun findByAttractionId(id: Long): GetAttractionLinksUseCase.Links {
        val attraction = attractionRepository.findById(id) ?: throw AttractionNotFoundException(id)
        val collected = linkRepository.findLinks(id)
        val pending = COLLECTED_SOURCES.count { enqueueIfDue(id, it) } > 0
        return GetAttractionLinksUseCase.Links(
            collected = collected,
            deepLinks = AttractionDeepLinks.of(attraction.title),
            pending = pending,
        )
    }

    override fun findDue(
        source: AttractionLinkSource,
        limit: Int,
    ): List<CollectAttractionLinksUseCase.DueItem> {
        val budget = remainingBudget(source)
        if (budget <= 0) {
            log.info { "[$source] 일일 예산 소진 — 다음 실행으로 넘긴다" }
            return emptyList()
        }
        val requests = linkRepository.findDueRequests(
            source = source,
            now = LocalDateTime.now(),
            limit = minOf(limit, budget),
        )
        if (requests.isEmpty()) return emptyList()

        val byId = attractionRepository.findAllByIds(requests.map { it.attractionId }).associateBy { it.id }
        return requests.mapNotNull { request ->
            byId[request.attractionId]?.let {
                CollectAttractionLinksUseCase.DueItem(
                    attractionId = request.attractionId,
                    title = it.title,
                    lang = it.lang,
                    latitude = it.latitude,
                    longitude = it.longitude,
                )
            }
        }
    }

    override fun apply(
        source: AttractionLinkSource,
        results: List<CollectAttractionLinksUseCase.Result>,
    ): CollectAttractionLinksUseCase.Applied {
        var collected = 0
        var empty = 0
        var failed = 0
        val now = LocalDateTime.now()

        results.forEach { result ->
            val request = linkRepository.findRequest(result.attractionId, source)
                ?: AttractionLinkRequest.create(result.attractionId, source, now)
            when {
                // 429·네트워크 — 원천의 답을 못 받았다. 결과 0건과 구분한다.
                result.failed -> {
                    request.markFailed(now)
                    failed++
                }
                result.links.isEmpty() -> {
                    linkRepository.replaceLinks(result.attractionId, source, emptyList())
                    request.markEmpty(now)
                    empty++
                }
                else -> {
                    linkRepository.replaceLinks(
                        result.attractionId,
                        source,
                        result.links.mapIndexed { index, link -> link.toDomain(result.attractionId, source, index, now) },
                    )
                    request.markCollected(now)
                    collected++
                }
            }
            linkRepository.saveRequest(request)
        }
        log.info { "[$source] 적용 — 수집 $collected · 결과없음 $empty · 실패 $failed" }
        return CollectAttractionLinksUseCase.Applied(collected, empty, failed)
    }

    /**
     * 조회가 큐를 채운다. **적재 실패가 조회를 막지 않는다** — 링크는 부수 정보고 상세는 본질이다.
     * 반환값은 "이 소스를 기다리는 중인가".
     */
    private fun enqueueIfDue(attractionId: Long, source: AttractionLinkSource): Boolean = runCatching {
        val existing = linkRepository.findRequest(attractionId, source)
        if (existing == null) {
            linkRepository.saveRequest(AttractionLinkRequest.create(attractionId, source))
            return@runCatching true
        }
        existing.markViewed()
        linkRepository.saveRequest(existing)
        existing.isDue()
    }.getOrElse {
        log.warn(it) { "링크 수집 큐 적재 실패 — 조회는 계속한다 (attractionId=$attractionId, source=$source)" }
        false
    }

    /** 오늘 남은 외부 호출 수. 성공·빈결과·실패를 모두 센다 — 셋 다 실제로 호출을 썼다. */
    private fun remainingBudget(source: AttractionLinkSource): Int {
        val used = linkRepository.countAttemptsSince(source, LocalDate.now().atStartOfDay())
        return (dailyBudget(source) - used).toInt().coerceAtLeast(0)
    }

    private fun CollectAttractionLinksUseCase.Link.toDomain(
        attractionId: Long,
        source: AttractionLinkSource,
        index: Int,
        now: LocalDateTime,
    ): AttractionLink = AttractionLink.create(
        attractionId = attractionId,
        source = source,
        externalId = externalId,
        title = title,
        url = url,
        thumbnailUrl = thumbnailUrl,
        author = author,
        publishedAt = publishedAt,
        sortOrder = index,
        collectedAt = now,
    )

    companion object {
        /** 조회가 큐를 채우는 소스. 딥링크는 조립되므로 큐가 없다. */
        private val COLLECTED_SOURCES = listOf(AttractionLinkSource.YOUTUBE)

        /**
         * 일일 예산 — 제공자 쿼터에서 나온 값이지 조절 손잡이가 아니다.
         * YouTube Data API v3: 하루 10,000 units, `search.list` 가 건당 100 units → 100건.
         * 네이버 검색 API: 하루 25,000콜 — 다른 용도와 나눠 쓰도록 여유를 둔다.
         */
        private fun dailyBudget(source: AttractionLinkSource): Long = when (source) {
            AttractionLinkSource.YOUTUBE -> 100
            AttractionLinkSource.NAVER_BLOG -> 5_000
        }
    }
}
