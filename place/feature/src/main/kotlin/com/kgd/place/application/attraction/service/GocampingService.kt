package com.kgd.place.application.attraction.service

import com.kgd.place.application.attraction.port.AttractionRepositoryPort
import com.kgd.place.application.attraction.port.GocampingSiteRepositoryPort
import com.kgd.place.application.attraction.usecase.SyncGocampingUseCase
import com.kgd.place.domain.attraction.model.Attraction
import com.kgd.place.domain.attraction.model.GocampingSite
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service

/**
 * 고캠핑 원천 표 적재. 겹치지 않아 관광지 행이 된 곳은 그 행 id 를 [GocampingSite.attractionId] 로 잇는다 —
 * 수집기가 관광지 행(source=GOCAMPING)을 먼저 올리고 이 표를 보낸다.
 */
@Service
class GocampingService(
    private val sites: GocampingSiteRepositoryPort,
    private val attractions: AttractionRepositoryPort,
) : SyncGocampingUseCase {
    private val log = KotlinLogging.logger {}

    override fun upsert(items: List<SyncGocampingUseCase.Item>): SyncGocampingUseCase.Applied {
        require(items.isNotEmpty()) { "items 는 비어있을 수 없습니다" }
        val ids = attractions.findIdsBySource(Attraction.GOCAMPING, LANG, items.map { it.contentId }.toSet())
        val rows = items.map {
            GocampingSite(
                it.contentId, it.facilityName, it.manageStatus, it.latitude, it.longitude, it.itemRaw,
                it.matchedAttractionId, it.matchMethod, ids[it.contentId], it.syncedAt,
            )
        }
        val applied = sites.upsertAll(rows)
        val linked = rows.count { it.attractionId != null }
        log.info { "고캠핑: 받음 ${items.size} · 반영 $applied · 관광지 행 $linked · 겹침 ${rows.count { it.matchedAttractionId != null }}" }
        return SyncGocampingUseCase.Applied(applied, linked)
    }

    private companion object {
        /** 고캠핑은 국문만 준다 */
        const val LANG = "ko"
    }
}
