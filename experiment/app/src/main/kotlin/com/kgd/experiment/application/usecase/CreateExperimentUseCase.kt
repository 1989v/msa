package com.kgd.experiment.application.usecase

import com.kgd.experiment.domain.model.Experiment
import com.kgd.experiment.domain.port.ExperimentRepositoryPort
import org.springframework.stereotype.Service

@Service
class CreateExperimentUseCase(
    private val repository: ExperimentRepositoryPort
) {
    fun execute(experiment: Experiment): Experiment = repository.save(experiment)
}
