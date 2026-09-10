package com.kgd.experiment.presentation.dto

import com.kgd.experiment.domain.model.ExperimentStatus

data class ChangeStatusRequest(
    val status: ExperimentStatus
)
