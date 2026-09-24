package com.kgd.promotion.presentation.point.dto

import jakarta.validation.constraints.Min
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

/** 어드민 포인트 지급(데모) — 사유 필수 */
data class GrantPointsRequest(
    @field:NotBlank @field:Size(max = 64)
    val memberId: String,
    @field:Min(1)
    val amount: Long,
    @field:NotBlank @field:Size(max = 500)
    val reason: String,
)
