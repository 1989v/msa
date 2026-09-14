package com.kgd.place.presentation.attraction.controller

import com.kgd.common.response.ApiResponse
import com.kgd.place.application.attraction.usecase.CollectAttractionLinksUseCase
import com.kgd.place.application.attraction.usecase.GetAttractionLinksUseCase
import com.kgd.place.domain.attraction.model.AttractionLinkSource
import jakarta.validation.Valid
import jakarta.validation.constraints.NotEmpty
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDateTime

/**
 * 수집기(place-ingest) 전용 경로 (ADR-0070 §3).
 *
 * `/api` 가 아니라 `/internal` 인 이유: 게이트웨이는 ADR-0061 이후 `/api`·`/sse`·`/ws`·`/actuator`
 * 만 받으므로 이 경로는 **클러스터 밖에서 닿지 않는다**. ADMIN 토큰을 발급해 도는 것보다 단순하고
 * 노출면도 작다 (recommendation 의 `/internal/sync` 와 같은 패턴).
 */
@RestController
@RequestMapping("/internal/attractions/links")
class AttractionLinkInternalController(
    private val collectAttractionLinksUseCase: CollectAttractionLinksUseCase,
    private val getAttractionLinksUseCase: GetAttractionLinksUseCase,
) {

    /** 일일 예산이 남은 만큼만 나온다. 빈 목록은 실패가 아니라 "오늘 몫을 다 썼다"는 뜻이다. */
    @GetMapping("/pending")
    fun findPending(
        @RequestParam source: AttractionLinkSource,
        @RequestParam(defaultValue = "100") limit: Int,
    ): ApiResponse<PendingLinksResponse> {
        val items = collectAttractionLinksUseCase.findDue(source, limit.coerceIn(1, 500))
        return ApiResponse.success(
            PendingLinksResponse(
                items = items.map {
                    PendingLinkItem(it.attractionId, it.title, it.lang, it.latitude, it.longitude)
                },
            ),
        )
    }

    /**
     * 수집 대상 큐 등록 (ADR-0095). 수집기가 **인기순으로 고른 관광지**를 올린다.
     * 예전에는 사용자가 상세를 열 때 올라갔는데, 그 경로는 링크가 색인으로 가면서 사라진다.
     */
    /**
     * 색인용 벌크 조회 (ADR-0095). 재색인이 페이지마다 부른다 — **큐를 건드리지 않는다.**
     */
    @PostMapping("/lookup")
    fun lookup(@Valid @RequestBody request: LookupLinksRequest): ApiResponse<LookupLinksResponse> {
        val found = getAttractionLinksUseCase.findByAttractionIds(request.ids)
        return ApiResponse.success(
            LookupLinksResponse(
                items = found.map { (id, links) ->
                    LookupLinksItem(
                        attractionId = id,
                        collected = links.collected.map {
                            LookupLink(it.source.name, it.title, it.url, it.thumbnailUrl, it.author)
                        },
                        deepLinks = links.deepLinks.map {
                            LookupDeepLink(it.provider, it.kind.name, it.url, it.revenueType.name)
                        },
                    )
                },
            ),
        )
    }

    @PostMapping("/enqueue")
    fun enqueue(@Valid @RequestBody request: EnqueueLinksRequest): ApiResponse<EnqueueLinksResponse> =
        ApiResponse.success(EnqueueLinksResponse(collectAttractionLinksUseCase.enqueue(request.attractionIds)))

    @PostMapping("/bulk")
    fun applyResults(
        @Valid @RequestBody request: ApplyLinkResultsRequest,
    ): ApiResponse<ApplyLinkResultsResponse> {
        val applied = collectAttractionLinksUseCase.apply(
            request.source,
            request.results.map { it.toResult() },
        )
        return ApiResponse.success(
            ApplyLinkResultsResponse(applied.collected, applied.empty, applied.failed),
        )
    }
}

data class LookupLinksRequest(
    @field:NotEmpty val ids: List<Long> = emptyList(),
)

data class LookupLinksResponse(val items: List<LookupLinksItem>)

data class LookupLinksItem(
    val attractionId: Long,
    val collected: List<LookupLink>,
    val deepLinks: List<LookupDeepLink>,
)

data class LookupLink(
    val source: String, val title: String, val url: String,
    val thumbnailUrl: String?, val author: String?,
)

data class LookupDeepLink(
    val provider: String, val kind: String, val url: String, val revenueType: String,
)

data class EnqueueLinksRequest(
    @field:NotEmpty val attractionIds: List<Long> = emptyList(),
)

data class EnqueueLinksResponse(val enqueued: Int)

data class PendingLinksResponse(val items: List<PendingLinkItem>)

data class PendingLinkItem(
    val attractionId: Long,
    val title: String,
    val lang: String,
    val latitude: Double,
    val longitude: Double,
)

data class ApplyLinkResultsRequest(
    val source: AttractionLinkSource,
    @field:NotEmpty(message = "results 는 비어있을 수 없습니다")
    val results: List<Item>,
) {
    /**
     * `failed` 와 "links 가 빈 배열"은 다른 뜻이다 — 전자는 원천의 답을 못 받은 것이고
     * 후자는 원천이 0건이라고 답한 것이다. 섞으면 실패한 레코드의 재시도가 유효기간만큼 밀린다.
     */
    data class Item(
        val attractionId: Long,
        val links: List<Link> = emptyList(),
        val failed: Boolean = false,
    ) {
        fun toResult() = CollectAttractionLinksUseCase.Result(
            attractionId = attractionId,
            links = links.map {
                CollectAttractionLinksUseCase.Link(
                    externalId = it.externalId,
                    title = it.title,
                    url = it.url,
                    thumbnailUrl = it.thumbnailUrl,
                    author = it.author,
                    publishedAt = it.publishedAt,
                    viewCount = it.viewCount,
                )
            },
            failed = failed,
        )
    }

    data class Link(
        val externalId: String,
        val title: String,
        val url: String,
        val thumbnailUrl: String? = null,
        val author: String? = null,
        val publishedAt: LocalDateTime? = null,
        val viewCount: Long? = null,
    )
}

data class ApplyLinkResultsResponse(val collected: Int, val empty: Int, val failed: Int)
