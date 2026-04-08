package com.kgd.experiment.domain.model

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import java.time.LocalDateTime

data class Experiment(
    val id: Long?,
    val name: String,
    val description: String,
    val status: ExperimentStatus,
    val trafficPercentage: Int,
    val variants: List<Variant>,
    val startDate: LocalDateTime?,
    val endDate: LocalDateTime?,
    val createdAt: LocalDateTime
) {
    init {
        require(trafficPercentage in 0..100) { "Traffic percentage must be 0-100: $trafficPercentage" }
        require(variants.isNotEmpty()) { "Experiment must have at least one variant" }
        val weightSum = variants.sumOf { it.weight }
        require(weightSum == 100) { "Variant weights must sum to 100, got: $weightSum" }
    }

    fun changeStatus(newStatus: ExperimentStatus): Experiment {
        if (!status.canTransitionTo(newStatus)) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "Cannot transition from $status to $newStatus")
        }
        return copy(status = newStatus)
    }
}
