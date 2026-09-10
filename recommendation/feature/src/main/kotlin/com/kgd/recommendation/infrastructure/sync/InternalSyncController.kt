package com.kgd.recommendation.infrastructure.sync

import com.kgd.common.response.ApiResponse
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * 내부 운영 endpoint — Argo CronWorkflow 가 호출.
 *
 * K8s NetworkPolicy 로 cluster-internal 호출만 허용. 외부 노출 금지.
 * gateway 의 라우팅에는 포함하지 않는다 (/internal prefix).
 */
@RestController
@RequestMapping("/internal/sync")
class InternalSyncController(
    private val cbScoreSync: CbScoreSync,
    private val itemSimilaritySync: ItemSimilaritySync,
) {
    @PostMapping("/cb-score")
    fun runCbScoreSync(): ApiResponse<CbScoreSync.SyncResult> {
        val result = cbScoreSync.sync()
        return ApiResponse.success(result)
    }

    /** Phase 2 — Item-Item CF (PPMI) 재계산 + Redis sync. */
    @PostMapping("/item-similarity")
    fun runItemSimilaritySync(): ApiResponse<ItemSimilaritySync.SyncResult> {
        val result = itemSimilaritySync.sync()
        return ApiResponse.success(result)
    }
}
