package com.kgd.experiment.presentation.dto

data class AssignmentResponse(
    val experimentId: Long,
    val userId: String,
    val variant: String
)
