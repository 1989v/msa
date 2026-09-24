package com.kgd.payment.presentation.opsissue.dto

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

data class CloseOpsIssueRequest(
    @field:NotBlank @field:Size(max = 500)
    val reason: String,
)
