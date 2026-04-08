package com.kgd.experiment.presentation.dto

import com.kgd.experiment.domain.model.Experiment
import com.kgd.experiment.domain.model.ExperimentStatus
import java.time.LocalDateTime

data class ExperimentResponse(
    val id: Long?,
    val name: String,
    val description: String,
    val status: ExperimentStatus,
    val trafficPercentage: Int,
    val variants: List<VariantResponse>,
    val startDate: LocalDateTime?,
    val endDate: LocalDateTime?,
    val createdAt: LocalDateTime
) {
    companion object {
        fun from(experiment: Experiment) = ExperimentResponse(
            id = experiment.id,
            name = experiment.name,
            description = experiment.description,
            status = experiment.status,
            trafficPercentage = experiment.trafficPercentage,
            variants = experiment.variants.map { VariantResponse(it.id, it.name, it.weight, it.config) },
            startDate = experiment.startDate,
            endDate = experiment.endDate,
            createdAt = experiment.createdAt
        )
    }
}

data class VariantResponse(
    val id: Long?,
    val name: String,
    val weight: Int,
    val config: Map<String, Any>
)
