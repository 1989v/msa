package com.kgd.place.application.attraction.usecase

import com.kgd.place.domain.attraction.model.AttractionLinkSource
import java.time.LocalDateTime

/**
 * 수집기(place-ingest)가 쓰는 경로 (ADR-0070 §3). 게이트웨이가 라우팅하지 않는 `/internal` 이라
 * 클러스터 밖에서 닿지 않는다 — 쓰기용 ADMIN 토큰을 발급해 도는 것보다 단순하고 노출면도 작다.
 */
interface CollectAttractionLinksUseCase {
    /** 일일 예산이 남은 만큼만 돌려준다. 소진되면 빈 목록 — 실패가 아니라 정상이다. */
    fun findDue(source: AttractionLinkSource, limit: Int): List<DueItem>

    fun apply(source: AttractionLinkSource, results: List<Result>): Applied

    data class DueItem(
        val attractionId: Long,
        val title: String,
        val lang: String,
        val latitude: Double,
        val longitude: Double,
    )

    /**
     * `failed = true` 는 429·네트워크처럼 **원천의 답을 못 받은** 경우다. 결과가 0건인 것과
     * 구분해야 한다 — 섞으면 실패한 레코드가 유효 기간만큼 재시도되지 않는다.
     */
    data class Result(
        val attractionId: Long,
        val links: List<Link> = emptyList(),
        val failed: Boolean = false,
    )

    data class Link(
        val externalId: String,
        val title: String,
        val url: String,
        val thumbnailUrl: String? = null,
        val author: String? = null,
        val publishedAt: LocalDateTime? = null,
        val viewCount: Long? = null,
    )

    data class Applied(val collected: Int, val empty: Int, val failed: Int)
}
