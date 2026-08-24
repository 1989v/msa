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
import com.kgd.common.quota.ExternalApiProvider
import com.kgd.common.quota.ExternalApiQuotaLedger
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
    private val quotaLedger: ExternalApiQuotaLedger,
) : GetAttractionLinksUseCase, CollectAttractionLinksUseCase {

    override fun findByAttractionId(id: Long): GetAttractionLinksUseCase.Links {
        val attraction = attractionRepository.findById(id) ?: throw AttractionNotFoundException(id)
        val collected = linkRepository.findLinks(id)
        val pending = COLLECTED_SOURCES.count { enqueueIfDue(id, it) } > 0
        return GetAttractionLinksUseCase.Links(
            collected = collected,
            // 표시명으로 조립한다 — 원천 제목은 꼬리 괄호에 다른 표기를 얹어 와서
            // (`Dosan Park(도산공원)`), 그대로 실으면 태그·검색어가 어디에도 없는 질의가 된다.
            deepLinks = AttractionDeepLinks.of(attraction.titleDisplay),
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
                    request.markCollected(now, freshDays(source))
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

    /**
     * 오늘 더 부를 수 있는 **호출 수** (ADR-0082).
     *
     * 자체 테이블(`countAttemptsSince`)을 세지 않는다 — 그러면 같은 제공자를 쓰는 다른
     * 서비스(quant 의 네이버 뉴스, deal 의 혜택 발견)를 모른 채 각자 "여유 있음"이라
     * 판단하게 된다. 쿼터는 API 키에 붙으므로 장부도 제공자 단위여야 한다.
     *
     * 장부는 **단위(unit)** 로 세므로 호출 수로 환산한다 — YouTube 는 1콜이 100 units 다.
     * 실제 증가는 호출하는 쪽(`place/ingest`, Python)이 같은 Redis 키에 한다.
     */
    private fun remainingBudget(source: AttractionLinkSource): Int {
        val provider = providerOf(source)
        val remainingUnits = quotaLedger.remaining(provider) ?: return Int.MAX_VALUE
        return (remainingUnits / unitCostOf(source)).toInt().coerceAtLeast(0)
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
        viewCount = viewCount,
        sortOrder = index,
        collectedAt = now,
    )

    companion object {
        /** 조회가 큐를 채우는 소스. 딥링크는 조립되므로 큐가 없다. */
        private val COLLECTED_SOURCES = listOf(
            AttractionLinkSource.YOUTUBE,
            AttractionLinkSource.NAVER_BLOG,
        )

        /**
          * 수집분 유효 기간. YouTube 는 API 서비스 약관이 **30일 넘게 보관하려면 갱신**하도록
          * 요구하므로 기본 90일을 쓸 수 없다. 하루 100건 예산과 겹치면 30일 안에 갱신할 수 있는
          * 관광지는 3,000곳이 상한이라는 뜻이기도 하다 — 조회 많은 곳부터 채우는 이유다.
          */
        private fun freshDays(source: AttractionLinkSource): Long = when (source) {
            AttractionLinkSource.YOUTUBE -> 30
            AttractionLinkSource.NAVER_BLOG -> AttractionLinkRequest.FRESH_DAYS
        }

        /** 소스 → 제공자. 한도는 provider 가 들고 있다 (ADR-0082) — 여기 상수를 두지 않는다. */
        private fun providerOf(source: AttractionLinkSource): ExternalApiProvider = when (source) {
            AttractionLinkSource.YOUTUBE -> ExternalApiProvider.YOUTUBE_DATA
            AttractionLinkSource.NAVER_BLOG -> ExternalApiProvider.NAVER_SEARCH
        }

        /** 1콜이 소비하는 단위. YouTube `search.list` 는 건당 100 units 다. */
        private fun unitCostOf(source: AttractionLinkSource): Long = when (source) {
            AttractionLinkSource.YOUTUBE -> 100
            AttractionLinkSource.NAVER_BLOG -> 1
        }
    }
}
