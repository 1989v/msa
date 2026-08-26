package com.kgd.codedictionary.application.techdomain.usecase

import com.kgd.codedictionary.application.techdomain.dto.TechDomainResultDto

/** 기술 도메인 조회. */
interface GetTechDomainsUseCase {
    fun activeDomains(): List<TechDomainResultDto>
}
