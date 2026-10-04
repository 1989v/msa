package com.kgd.place.application.attraction.service

import com.kgd.place.application.attraction.port.AttractionLinkRepositoryPort
import com.kgd.place.application.attraction.port.AttractionRepositoryPort
import com.kgd.place.application.attraction.usecase.CollectAttractionLinksUseCase
import com.kgd.place.application.attraction.usecase.GetAttractionLinksUseCase
import com.kgd.place.application.region.port.AdministrativeRegionRepositoryPort
import com.kgd.place.domain.attraction.model.Attraction
import com.kgd.place.domain.attraction.model.AttractionDeepLinks
import com.kgd.place.domain.attraction.model.AttractionTitle
import com.kgd.place.domain.region.model.AdministrativeRegionLevel
import com.kgd.place.domain.attraction.model.AttractionLink
import com.kgd.place.domain.attraction.model.AttractionLinkRequest
import com.kgd.place.domain.attraction.model.AttractionLinkSource
import com.kgd.place.domain.attraction.model.VideoDetails
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
    private val regionRepository: AdministrativeRegionRepositoryPort,
) : GetAttractionLinksUseCase, CollectAttractionLinksUseCase {

    override fun findByAttractionIds(ids: List<Long>): Map<Long, GetAttractionLinksUseCase.Links> =
        attractionRepository.findAllByIds(ids).mapNotNull { attraction ->
            val id = attraction.id ?: return@mapNotNull null
            id to GetAttractionLinksUseCase.Links(
                collected = linkRepository.findLinks(id),
                // 표시명으로 조립한다 — 원천 제목은 꼬리 괄호에 다른 표기를 얹어 와서
                // (`Dosan Park(도산공원)`), 그대로 실으면 태그·검색어가 어디에도 없는 질의가 된다.
                deepLinks = AttractionDeepLinks.of(attraction.titleDisplay, attraction.contentTypeId),
            )
        }.toMap()

    override fun enqueue(attractionIds: List<Long>): Int =
        attractionIds.count { id -> COLLECTED_SOURCES.count { enqueueIfDue(id, it) } > 0 }

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
        val queries = searchQueries(byId.values)
        return requests.mapNotNull { request ->
            byId[request.attractionId]?.let {
                CollectAttractionLinksUseCase.DueItem(
                    attractionId = request.attractionId,
                    title = it.title,
                    lang = it.lang,
                    latitude = it.latitude,
                    longitude = it.longitude,
                    query = queries[request.attractionId] ?: it.titleDisplay,
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

    override fun findVideosMissingDetails(limit: Int): List<String> =
        linkRepository.findVideoIdsMissingDetails(limit)

    override fun applyVideoDetails(details: List<VideoDetails>): Int {
        val updated = linkRepository.updateVideoDetails(details)
        log.info { "[YOUTUBE] 영상 길이·비율 채움 — 영상 ${details.size}개 · 행 $updated" }
        return updated
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
    /**
     * 영상 검색어 — 표시명 그대로. 국문 원천 제목이 꼬리 괄호에 지역 구분자를 달았으면(`용궁사(인천)`) 그것을,
     * 아니면 같은 표시명·언어의 관광지가 둘 이상일 때 시군구 이름을 붙인다.
     * 좌표 반경 검색은 촬영 위치를 적은 영상만 돌려줘 방송사·교양 채널의 대표 영상이 빠졌다(경복궁 151만 회 영상).
     * 반경을 빼면 이름이 같은 다른 지역 영상이 섞이므로, 이름이 겹치는 곳에만 지역을 붙여 가린다.
     */
    private fun searchQueries(attractions: Collection<Attraction>): Map<Long, String> {
        val shared = attractionRepository.countByTitleDisplay(attractions.map { it.titleDisplay }.toSet())
            .filter { it.total > 1 }
            .map { it.titleDisplay to it.lang }
            .toSet()
        val sigungu by lazy { regionRepository.findByLevel(AdministrativeRegionLevel.SIGUNGU).associateBy { it.code } }
        return attractions.mapNotNull { a ->
            val id = a.id ?: return@mapNotNull null
            // 원천이 이미 지역으로 갈라 둔 이름 — 이것이 가장 정확한 구분이다(국문 행의 꼬리 괄호는 지역 구분자)
            val qualifier = AttractionTitle.parse(a.title).local?.takeIf { a.lang == "ko" }
            if (qualifier != null) return@mapNotNull id to "${a.titleDisplay} $qualifier"
            if ((a.titleDisplay to a.lang) !in shared) return@mapNotNull null
            val region = a.ldongRegnCd?.let { regn -> a.ldongSignguCd?.let { sigungu[regn + it] } }
                ?: return@mapNotNull null
            val name = if (a.lang == "en") region.nameEn ?: region.name else region.name
            id to "${a.titleDisplay} $name"
        }.toMap()
    }

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
        duration = duration,
        embedWidth = embedWidth,
        embedHeight = embedHeight,
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
