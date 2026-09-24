package com.kgd.payment.presentation.opsissue.dto

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

/** 재시도 사유는 선택 — 남기면 행에 처리자와 함께 기록된다 */
data class RetryOpsIssueRequest(
    @field:Size(max = 500)
    val reason: String? = null,
)

data class CloseOpsIssueRequest(
    @field:NotBlank @field:Size(max = 500)
    val reason: String,
)
