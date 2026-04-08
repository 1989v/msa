package com.kgd.experiment.application.usecase

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.experiment.domain.model.Experiment
import com.kgd.experiment.domain.model.ExperimentStatus
import com.kgd.experiment.domain.port.ExperimentRepositoryPort
import org.springframework.stereotype.Service

@Service
class ChangeExperimentStatusUseCase(
    private val repository: ExperimentRepositoryPort
) {
    fun execute(id: Long, newStatus: ExperimentStatus): Experiment {
        val experiment = repository.findById(id)
            ?: throw BusinessException(ErrorCode.NOT_FOUND)
        val updated = experiment.changeStatus(newStatus)
        return repository.save(updated)
    }
}
