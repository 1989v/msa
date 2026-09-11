package com.kgd.place.application.attraction.service

import com.kgd.place.application.attraction.port.AttractionRepositoryPort
import com.kgd.place.application.attraction.usecase.CollectGooglePlaceIdsUseCase
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

private val log = KotlinLogging.logger {}

/**
 * 구글 place_id 보강 (data-sources.md §7) — 수집은 place-ingest CronJob, 여기는 큐 조회와 반영만.
 * 링크 수집(AttractionLinkService)과 같은 분업: 외부 API 를 부르는 것은 수집기 파드뿐이다.
 */
@Service
class AttractionGooglePlaceService(
    private val attractionRepository: AttractionRepositoryPort,
) : CollectGooglePlaceIdsUseCase {

    override fun findPending(lang: String?, limit: Int): List<CollectGooglePlaceIdsUseCase.PendingItem> =
        attractionRepository.findMissingGooglePlaceId(lang, limit).map {
            CollectGooglePlaceIdsUseCase.PendingItem(
                attractionId = requireNotNull(it.id) { "저장된 관광지에 ID가 없습니다" },
                // 표시명으로 묻는다 — `Dosan Park(도산공원)` 을 그대로 실으면 질의가 무너진다
                // (유튜브 수집이 같은 이유로 표시명을 쓴다).
                title = it.titleDisplay,
                lang = it.lang,
                address = it.address,
            )
        }

    @Transactional
    override fun apply(results: List<CollectGooglePlaceIdsUseCase.Result>): Int {
        if (results.isEmpty()) return 0
        val byId = attractionRepository.findAllByIds(results.map { it.attractionId })
            .associateBy { it.id }
        val enriched = results.mapNotNull { result ->
            byId[result.attractionId]?.apply { enrichGooglePlaceId(result.googlePlaceId) }
        }
        attractionRepository.saveAll(enriched)
        log.info { "[GOOGLE_PLACE] place_id 보강 ${enriched.size}건 (요청 ${results.size}건)" }
        return enriched.size
    }
}
