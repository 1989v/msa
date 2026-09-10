package com.kgd.experiment.application.experiment.usecase

import com.kgd.experiment.application.experiment.dto.ExperimentResultDto

interface GetExperimentResultsUseCase {
    fun execute(experimentId: Long): ExperimentResultDto
}
