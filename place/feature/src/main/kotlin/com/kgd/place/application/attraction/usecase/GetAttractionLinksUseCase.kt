package com.kgd.place.application.attraction.usecase

import com.kgd.place.domain.attraction.model.AttractionDeepLink
import com.kgd.place.domain.attraction.model.AttractionLink

/**
 * 관광지 외부 링크 (ADR-0070) — 재색인이 묶음으로 읽어 색인 문서에 싣는다. 화면은 place 를 부르지 않는다.
 *
 * 조립되는 딥링크는 항상 나가고, 수집형은 있으면 나간다. 조회 경로에서 외부 API 를 부르지 않는다.
 * 관광지 하나를 읽는 공개 조회(`GET /api/places/attractions/{id}/links`)는 없앴다 — 읽으면서 수집 큐에 쓰는
 * 부수효과가 있었고, 화면이 색인으로 옮긴 뒤 부르는 곳이 없었다.
 */
interface GetAttractionLinksUseCase {
    /**
     * 색인용 벌크 조회 (ADR-0095). **큐에 올리지 않는다** — 재색인이 6만 곳을 훑는데
     * 그때마다 수집 요청이 생기면 인기와 무관하게 큐가 가득 찬다.
     */
    fun findByAttractionIds(ids: List<Long>): Map<Long, Links>

    data class Links(
        val collected: List<AttractionLink>,
        val deepLinks: List<AttractionDeepLink>,
    )
}
