package com.kgd.experiment.application.usecase

import com.kgd.common.analytics.BucketAssigner
import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.experiment.domain.model.ExperimentStatus
import com.kgd.experiment.domain.port.ExperimentRepositoryPort
import org.springframework.stereotype.Service

@Service
class AssignBucketUseCase(
    private val repository: ExperimentRepositoryPort
) {
    fun execute(experimentId: Long, userId: String): String {
        val experiment = repository.findById(experimentId)
            ?: throw BusinessException(ErrorCode.NOT_FOUND)

        if (experiment.status != ExperimentStatus.RUNNING) {
            throw BusinessException(ErrorCode.INVALID_INPUT)
        }

        val variantWeights = experiment.variants.map { it.name to it.weight }
        return BucketAssigner.assign(userId, experimentId, variantWeights)
    }
}
