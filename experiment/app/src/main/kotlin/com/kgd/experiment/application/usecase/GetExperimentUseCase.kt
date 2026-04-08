package com.kgd.experiment.application.usecase

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.experiment.domain.model.Experiment
import com.kgd.experiment.domain.model.ExperimentStatus
import com.kgd.experiment.domain.port.ExperimentRepositoryPort
import org.springframework.stereotype.Service

@Service
class GetExperimentUseCase(
    private val repository: ExperimentRepositoryPort
) {
    fun execute(id: Long): Experiment =
        repository.findById(id) ?: throw BusinessException(ErrorCode.NOT_FOUND)

    fun executeAll(): List<Experiment> = repository.findAll()

    fun executeByStatus(status: ExperimentStatus): List<Experiment> =
        repository.findByStatus(status)
}
