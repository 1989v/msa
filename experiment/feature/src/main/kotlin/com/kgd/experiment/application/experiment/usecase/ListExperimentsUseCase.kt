package com.kgd.experiment.application.experiment.usecase

import com.kgd.experiment.domain.model.Experiment

interface ListExperimentsUseCase {
    fun execute(): List<Experiment>
}
