package com.kgd.place.presentation.attraction.controller

import com.kgd.common.response.ApiResponse
import com.kgd.place.application.attraction.usecase.LookupAttractionSimilarUseCase
import com.kgd.place.application.attraction.usecase.SyncAttractionSimilarUseCase
import jakarta.validation.Valid
import jakarta.validation.constraints.NotEmpty
import jakarta.validation.constraints.Size
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * 비슷한 곳 목록 — 임베딩(`AttractionEmbeddingInternalController`)과 같은 모양·같은 이유로 `/internal` 이다.
 * 게이트웨이가 라우팅하지 않아 클러스터 밖에서 닿지 않는다.
 *
 * 적재는 PUT — 문서마다 목록을 통째로 바꾸므로 같은 요청을 다시 보내도 결과가 같다(도구의 재시도가 안전하다).
 */
@RestController
@RequestMapping("/internal/attractions/similar")
class AttractionSimilarInternalController(
    private val syncSimilar: SyncAttractionSimilarUseCase,
    private val lookupSimilar: LookupAttractionSimilarUseCase,
) {

    @PutMapping("/bulk")
    fun bulk(@Valid @RequestBody request: SimilarBulkRequest): ApiResponse<SyncAttractionSimilarUseCase.Applied> =
        ApiResponse.success(
            syncSimilar.replace(
                request.modelRef,
                request.items.map { item ->
                    SyncAttractionSimilarUseCase.Document(
                        attractionId = item.attractionId,
                        similar = item.similar.map { SyncAttractionSimilarUseCase.Similar(it.id, it.score) },
                    )
                },
            ),
        )

    @PostMapping("/lookup")
    fun lookup(@Valid @RequestBody request: SimilarLookupRequest): ApiResponse<SimilarLookupResponse> =
        ApiResponse.success(
            SimilarLookupResponse(
                modelRef = request.modelRef,
                items = lookupSimilar.lookup(request.modelRef, request.ids).map { found ->
                    SimilarLookupResponse.Item(
                        attractionId = found.attractionId,
                        modelRef = found.modelRef,
                        similar = found.similar.map { SimilarLookupResponse.Similar(it.id, it.score) },
                    )
                },
            ),
        )

    companion object {
        /** 도구(`embed.client.MAX_BATCH`)·재색인(`PlaceApiClient.LOOKUP_MAX_BATCH`)과 같은 값. */
        const val MAX_BATCH = 500
    }
}

data class SimilarBulkRequest(
    val modelRef: String,
    @field:NotEmpty(message = "items 는 비어있을 수 없습니다")
    @field:Size(max = AttractionSimilarInternalController.MAX_BATCH, message = "한 번에 500건까지")
    val items: List<Item>,
) {
    /** [similar] 의 순서가 순위다. 빈 목록이면 그 문서의 목록을 지운다. */
    data class Item(val attractionId: Long, val similar: List<Similar>)

    data class Similar(val id: Long, val score: Double)
}

data class SimilarLookupRequest(
    val modelRef: String,
    @field:NotEmpty(message = "ids 는 비어있을 수 없습니다")
    @field:Size(max = AttractionSimilarInternalController.MAX_BATCH, message = "한 번에 500건까지")
    val ids: List<Long>,
)

data class SimilarLookupResponse(val modelRef: String, val items: List<Item>) {
    data class Item(val attractionId: Long, val modelRef: String, val similar: List<Similar>)

    data class Similar(val id: Long, val score: Double)
}
