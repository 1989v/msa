package com.kgd.codedictionary.application.service.dto

import com.fasterxml.jackson.annotation.JsonProperty
import com.kgd.codedictionary.domain.service.model.Service

data class ServiceResultDto(
    val code: String,
    val name: String,
    val description: String,
    val port: Int?,
    @get:JsonProperty("isPrivate")
    val isPrivate: Boolean,
    val concepts: List<String>
) {
    companion object {
        fun from(service: Service): ServiceResultDto = ServiceResultDto(
            code = service.code,
            name = service.name,
            description = service.description,
            port = service.port,
            isPrivate = service.isPrivate,
            concepts = service.conceptIds
        )
    }
}
