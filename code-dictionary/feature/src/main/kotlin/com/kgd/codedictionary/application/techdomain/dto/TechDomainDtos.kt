package com.kgd.codedictionary.application.techdomain.dto

import com.kgd.codedictionary.domain.techdomain.model.TechDomain

data class TechDomainResultDto(
    val code: String,
    val label: String,
    val tagline: String?,
    val conceptIds: List<String>,
) {
    companion object {
        fun from(domain: TechDomain) = TechDomainResultDto(
            code = domain.code,
            label = domain.label,
            tagline = domain.tagline,
            conceptIds = domain.conceptIds,
        )
    }
}
