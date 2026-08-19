package com.kgd.place.application.attraction.usecase

import com.kgd.place.domain.attraction.model.AttractionDeepLink

/**
 * 관광지 외부 링크 (ADR-0070). 지금은 조립되는 딥링크만 돌려준다 —
 * 수집형(YouTube·네이버)은 커넥터가 붙을 때 이 응답에 더해진다.
 */
interface GetAttractionLinksUseCase {
    fun findByAttractionId(id: Long): Links

    data class Links(val deepLinks: List<AttractionDeepLink>)
}
