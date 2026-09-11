package com.kgd.codedictionary.application.display.dto

import com.kgd.codedictionary.domain.display.model.DisplayService
import com.kgd.codedictionary.domain.display.model.DisplayStatus

data class DisplayServiceDto(
    val id: Long?,
    val code: String,
    val label: String,
    val tagline: String?,
    val href: String?,
    val status: DisplayStatus,
    val orderNo: Int,
) {
    companion object {
        fun from(service: DisplayService) = DisplayServiceDto(
            id = service.id,
            code = service.code,
            label = service.label,
            tagline = service.tagline,
            href = service.href,
            status = service.status,
            orderNo = service.orderNo,
        )
    }
}

data class DisplayServiceUpsertRequest(
    val id: Long? = null,
    val code: String,
    val label: String,
    val tagline: String? = null,
    val href: String? = null,
    val status: DisplayStatus = DisplayStatus.PREOPEN,
    val orderNo: Int = 0,
) {
    fun toDomain() = DisplayService(
        id = id,
        code = code.trim(),
        label = label.trim(),
        tagline = tagline?.trim()?.ifBlank { null },
        href = href?.trim()?.ifBlank { null },
        status = status,
        orderNo = orderNo,
    )
}
