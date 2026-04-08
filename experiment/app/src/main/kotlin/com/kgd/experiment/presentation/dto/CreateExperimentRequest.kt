package com.kgd.experiment.presentation.dto

import com.kgd.experiment.domain.model.Experiment
import com.kgd.experiment.domain.model.ExperimentStatus
import com.kgd.experiment.domain.model.Variant
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.NotBlank
import java.time.LocalDateTime

data class CreateExperimentRequest(
    @field:NotBlank val name: String,
    val description: String = "",
    @field:Min(0) @field:Max(100) val trafficPercentage: Int = 100,
    val variants: List<VariantRequest>,
    val startDate: LocalDateTime? = null,
    val endDate: LocalDateTime? = null
) {
    fun toDomain(): Experiment = Experiment(
        id = null,
        name = name,
        description = description,
        status = ExperimentStatus.DRAFT,
        trafficPercentage = trafficPercentage,
        variants = variants.map { it.toDomain() },
        startDate = startDate,
        endDate = endDate,
        createdAt = LocalDateTime.now()
    )
}

data class VariantRequest(
    val name: String,
    val weight: Int,
    val config: Map<String, Any> = emptyMap()
) {
    fun toDomain(): Variant = Variant(
        id = null,
        name = name,
        weight = weight,
        config = config
    )
}
