package com.kgd.experiment.application.experiment.usecase

import com.kgd.experiment.domain.model.Experiment

interface GetExperimentUseCase {
    fun execute(id: Long): Experiment
}
