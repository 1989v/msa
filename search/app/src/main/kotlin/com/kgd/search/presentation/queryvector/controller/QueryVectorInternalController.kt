package com.kgd.search.presentation.queryvector.controller

import com.kgd.common.response.ApiResponse
import com.kgd.search.application.queryvector.usecase.ManageQueryVectorsUseCase
import com.kgd.search.domain.embedding.VectorCodec
import com.kgd.search.domain.queryvector.model.QueryVector
import jakarta.validation.Valid
import jakarta.validation.constraints.NotEmpty
import jakarta.validation.constraints.Size
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/**
 * 질의 사전 동기화 전용 경로 (ADR-0090 §3.4).
 *
 * `/api` 가 아니라 `/internal` — 게이트웨이는 `/api`·`/sse`·`/ws`·`/actuator` 만 받으므로 클러스터 밖에서 닿지 않는다.
 * 도구(`tools/embed`)는 port-forward 로 들어온다. place 의 임베딩 내부 API 와 같은 이유·같은 모양.
 */
@RestController
@RequestMapping("/internal/query-vectors")
class QueryVectorInternalController(
    private val manageQueryVectors: ManageQueryVectorsUseCase,
) {

    @PutMapping("/bulk")
    fun bulk(@Valid @RequestBody request: UpsertRequest): ApiResponse<ManageQueryVectorsUseCase.Applied> =
        ApiResponse.success(manageQueryVectors.upsert(request.modelRef, request.items.map { it.toItem(request.dim) }))

    @GetMapping("/misses")
    fun misses(
        @RequestParam modelRef: String,
        @RequestParam(defaultValue = "500") limit: Int,
    ): ApiResponse<List<ManageQueryVectorsUseCase.Miss>> =
        ApiResponse.success(manageQueryVectors.misses(modelRef, limit.coerceIn(1, MAX_BATCH)))

    /** 도구가 사전에 넣은 뒤 지운다 — **넣은 것만** 지워야 실패한 질의가 카운트를 잃지 않는다. */
    @DeleteMapping("/misses")
    fun clearMisses(@Valid @RequestBody request: ClearMissesRequest): ApiResponse<Map<String, Int>> =
        ApiResponse.success(mapOf("removed" to manageQueryVectors.clearMisses(request.modelRef, request.normalized)))

    @GetMapping("/status")
    fun status(@RequestParam modelRef: String): ApiResponse<ManageQueryVectorsUseCase.Status> =
        ApiResponse.success(manageQueryVectors.status(modelRef))

    companion object {
        /** place 의 임베딩 API 와 같은 상한. 도구가 한 벌의 규칙만 지키면 되게 한다. */
        const val MAX_BATCH = 500
    }
}

data class UpsertRequest(
    val modelRef: String,
    val dim: Int,
    @field:NotEmpty(message = "items 는 비어있을 수 없습니다")
    @field:Size(max = QueryVectorInternalController.MAX_BATCH, message = "한 번에 500건까지")
    val items: List<Item>,
) {
    data class Item(
        /** 원문 그대로. **정규화는 서버가 한다** — 규칙이 두 곳에 있으면 사전 `_id` 가 어긋난다. */
        val query: String,
        /** float32 little-endian 의 base64. */
        val vector: String,
        val source: QueryVector.Source,
    ) {
        fun toItem(dim: Int): ManageQueryVectorsUseCase.Item {
            val decoded = VectorCodec.decode(vector)
            require(decoded.size == dim) { "벡터 차원이 다릅니다: ${decoded.size} != $dim (query=$query)" }
            return ManageQueryVectorsUseCase.Item(query = query, vector = decoded, source = source)
        }
    }
}

data class ClearMissesRequest(
    val modelRef: String,
    @field:NotEmpty(message = "normalized 는 비어있을 수 없습니다")
    @field:Size(max = QueryVectorInternalController.MAX_BATCH, message = "한 번에 500건까지")
    val normalized: List<String>,
)
