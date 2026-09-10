package com.kgd.experiment.application.experiment.usecase

import com.kgd.experiment.domain.model.Experiment
import com.kgd.experiment.domain.model.ExperimentStatus

interface ChangeExperimentStatusUseCase {
    fun execute(command: Command): Experiment

    data class Command(val id: Long, val status: ExperimentStatus)
}
