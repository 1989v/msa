package com.kgd.place.application.attraction.service

import com.kgd.place.application.attraction.port.AttractionOverviewProbeRepositoryPort
import com.kgd.place.application.attraction.usecase.AttractionOverviewProbeUseCase
import com.kgd.place.domain.attraction.model.AttractionOverviewProbe
import org.springframework.stereotype.Service

/**
 * 개요 수집 negative cache (ADR-0070). 수집기(place-ingest)가 제외 목록을 받아 가고,
 * 원천이 빈 개요를 준 레코드를 여기에 남긴다.
 */
@Service
class AttractionOverviewProbeService(
    private val probeRepository: AttractionOverviewProbeRepositoryPort,
) : AttractionOverviewProbeUseCase {

    override fun record(commands: List<AttractionOverviewProbeUseCase.Command>): Int =
        probeRepository.recordAll(
            commands.map { AttractionOverviewProbe.create(contentId = it.contentId, lang = it.lang) },
        )

    override fun findKeys(lang: String?): List<String> =
        probeRepository.findAll(lang).map { it.key }
}
