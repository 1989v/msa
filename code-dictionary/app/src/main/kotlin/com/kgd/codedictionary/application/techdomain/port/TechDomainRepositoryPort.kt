package com.kgd.codedictionary.application.techdomain.port

import com.kgd.codedictionary.domain.techdomain.model.TechDomain

interface TechDomainRepositoryPort {
    /** 전시 대상. 비활성 제외는 저장소 경계에서 끝낸다 — 호출부가 잊을 수 있는 필터를 남기지 않는다. */
    fun findAllActiveOrdered(): List<TechDomain>
}
