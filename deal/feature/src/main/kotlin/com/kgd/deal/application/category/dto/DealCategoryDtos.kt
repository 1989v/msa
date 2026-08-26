package com.kgd.deal.application.category.dto

import com.kgd.deal.domain.model.DisplayStatus
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

data class DealCategoryResponse(
    val code: String,
    val label: String,
    val tagline: String?,
)

data class DealCategoryAdminResponse(
    val id: Long,
    val code: String,
    val label: String,
    val tagline: String?,
    val status: DisplayStatus,
    val orderNo: Int,
    val offerCount: Long,
)

data class DealCategoryRequest(
    @field:NotBlank @field:Size(max = 40) val code: String,
    @field:NotBlank @field:Size(max = 80) val label: String,
    @field:Size(max = 200) val tagline: String? = null,
    val status: DisplayStatus = DisplayStatus.OPEN,
    val orderNo: Int = 0,
)
