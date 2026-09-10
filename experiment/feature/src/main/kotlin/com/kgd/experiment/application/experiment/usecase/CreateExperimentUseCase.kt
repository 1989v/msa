package com.kgd.experiment.application.experiment.usecase

import com.kgd.experiment.domain.model.Experiment

interface CreateExperimentUseCase {
    fun execute(experiment: Experiment): Experiment
}
