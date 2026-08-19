package com.kgd.place.application.attraction.usecase

import com.kgd.place.domain.attraction.model.AttractionDeepLink
import com.kgd.place.domain.attraction.model.AttractionLink

/**
 * 관광지 외부 링크 (ADR-0070).
 *
 * 조립되는 딥링크는 항상 즉시 나가고, 수집형은 있으면 나간다. **조회 경로에서 외부 API 를
 * 동기로 부르지 않는다** — P99 가 외부 지연에 묶이고(ADR-0025) 트랜잭션 안 외부 IO 금지와도
 * 충돌한다. 없으면 큐에 적고 [Links.pending] 으로 알린다.
 */
interface GetAttractionLinksUseCase {
    fun findByAttractionId(id: Long): Links

    data class Links(
        val collected: List<AttractionLink>,
        val deepLinks: List<AttractionDeepLink>,
        /** 수집 대기 중 — 화면은 오류가 아니라 "곧 채워짐"으로 그린다. */
        val pending: Boolean,
    )
}
