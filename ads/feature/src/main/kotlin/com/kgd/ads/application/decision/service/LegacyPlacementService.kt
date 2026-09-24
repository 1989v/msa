package com.kgd.ads.application.decision.service

import com.kgd.ads.application.decision.usecase.GetLegacyPlacementUseCase
import com.kgd.ads.application.decision.usecase.GetLegacyPlacementUseCase.LegacyHouseCreative
import com.kgd.ads.application.decision.usecase.GetLegacyPlacementUseCase.LegacyPlacement
import org.springframework.stereotype.Service

@Service
class LegacyPlacementService(
    private val candidateIndex: CandidateIndexService,
) : GetLegacyPlacementUseCase {

    override fun execute(placementKey: String): LegacyPlacement? {
        val snapshot = candidateIndex.current() ?: return LegacyPlacement(placementKey, emptyList())
        if (placementKey !in snapshot.placements) return null
        val creatives = snapshot.houseByPlacement[placementKey].orEmpty().map {
            LegacyHouseCreative(it.content.title, it.content.body, it.content.link.value, it.content.emoji)
        }
        return LegacyPlacement(placementKey, creatives)
    }
}
