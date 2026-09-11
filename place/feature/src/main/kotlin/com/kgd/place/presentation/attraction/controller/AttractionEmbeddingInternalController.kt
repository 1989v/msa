package com.kgd.place.presentation.attraction.controller

import com.kgd.common.response.ApiResponse
import com.kgd.place.application.attraction.usecase.LookupAttractionEmbeddingsUseCase
import com.kgd.place.application.attraction.usecase.SyncAttractionEmbeddingsUseCase
import jakarta.validation.Valid
import jakarta.validation.constraints.NotEmpty
import jakarta.validation.constraints.Size
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.util.Base64

/**
 * 임베딩 동기화 전용 경로 (ADR-0090).
 *
 * `/api` 가 아니라 `/internal` — 게이트웨이는 `/api`·`/sse`·`/ws`·`/actuator` 만 받으므로 클러스터 밖에서 닿지 않는다.
 * 도구(`tools/embed`)는 ssh 터널 + port-forward 로 들어온다. `AttractionLinkInternalController` 와 같은 이유·같은 모양.
 *
 * 벡터는 **float32 little-endian 바이트의 base64** 로 주고받는다 — JSON 실수 배열보다 3배 작고 파싱이 빠르다.
 */
@RestController
@RequestMapping("/internal/attractions/embeddings")
class AttractionEmbeddingInternalController(
    private val syncEmbeddings: SyncAttractionEmbeddingsUseCase,
    private val lookupEmbeddings: LookupAttractionEmbeddingsUseCase,
) {

    @GetMapping("/pending")
    fun pending(
        @RequestParam modelRef: String,
        @RequestParam(defaultValue = "500") limit: Int,
    ): ApiResponse<SyncAttractionEmbeddingsUseCase.Pending> =
        ApiResponse.success(syncEmbeddings.findPending(modelRef, limit.coerceIn(1, MAX_BATCH)))

    @PutMapping("/bulk")
    fun bulk(@Valid @RequestBody request: UpsertRequest): ApiResponse<SyncAttractionEmbeddingsUseCase.Applied> {
        val items = request.items.map { it.toItem(request.dim) }
        return ApiResponse.success(syncEmbeddings.upsert(request.modelRef, items))
    }

    @PostMapping("/lookup")
    fun lookup(@Valid @RequestBody request: LookupRequest): ApiResponse<LookupResponse> {
        val found = lookupEmbeddings.lookup(request.modelRef, request.ids)
        return ApiResponse.success(
            LookupResponse(
                modelRef = request.modelRef,
                items = found.map {
                    LookupItem(
                        attractionId = it.attractionId,
                        textHash = it.textHash,
                        vector = encode(it.vector),
                        embeddedAt = it.embeddedAt.toString(),
                    )
                },
            ),
        )
    }

    @GetMapping("/status")
    fun status(@RequestParam modelRef: String): ApiResponse<SyncAttractionEmbeddingsUseCase.Status> =
        ApiResponse.success(syncEmbeddings.status(modelRef))

    /** 옛 스탬프 정리 — 모델을 바꾸고 새 벡터가 다 들어간 뒤에만 부른다. */
    @DeleteMapping
    fun deleteModel(@RequestParam modelRef: String): ApiResponse<Map<String, Int>> =
        ApiResponse.success(mapOf("deleted" to syncEmbeddings.deleteModel(modelRef)))

    companion object {
        const val MAX_BATCH = 500

        fun encode(vector: FloatArray): String {
            val buf = java.nio.ByteBuffer.allocate(vector.size * Float.SIZE_BYTES)
                .order(java.nio.ByteOrder.LITTLE_ENDIAN)
            vector.forEach { buf.putFloat(it) }
            return Base64.getEncoder().encodeToString(buf.array())
        }

        fun decode(base64: String, expectedDim: Int): FloatArray {
            val bytes = Base64.getDecoder().decode(base64)
            require(bytes.size == expectedDim * Float.SIZE_BYTES) {
                "벡터 바이트 길이가 dim 과 맞지 않습니다: ${bytes.size} != ${expectedDim * Float.SIZE_BYTES}"
            }
            val buf = java.nio.ByteBuffer.wrap(bytes).order(java.nio.ByteOrder.LITTLE_ENDIAN)
            return FloatArray(expectedDim) { buf.float }
        }
    }
}

data class UpsertRequest(
    val modelRef: String,
    val dim: Int,
    @field:NotEmpty(message = "items 는 비어있을 수 없습니다")
    @field:Size(max = AttractionEmbeddingInternalController.MAX_BATCH, message = "한 번에 500건까지")
    val items: List<Item>,
) {
    data class Item(
        val attractionId: Long,
        val embeddingText: String,
        val textHash: String,
        /** null 이면 touch — 저장된 text_hash 와 같아야 한다. */
        val vector: String? = null,
    ) {
        fun toItem(dim: Int) = SyncAttractionEmbeddingsUseCase.Item(
            attractionId = attractionId,
            embeddingText = embeddingText,
            textHash = textHash,
            vector = vector?.let { AttractionEmbeddingInternalController.decode(it, dim) },
        )
    }
}

data class LookupRequest(
    val modelRef: String,
    @field:NotEmpty(message = "ids 는 비어있을 수 없습니다")
    @field:Size(max = AttractionEmbeddingInternalController.MAX_BATCH, message = "한 번에 500건까지")
    val ids: List<Long>,
)

data class LookupResponse(val modelRef: String, val items: List<LookupItem>)

data class LookupItem(
    val attractionId: Long,
    val textHash: String,
    /** float32 little-endian 의 base64. */
    val vector: String,
    val embeddedAt: String,
)
