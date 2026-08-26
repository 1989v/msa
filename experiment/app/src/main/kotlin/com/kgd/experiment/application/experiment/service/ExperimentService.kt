package com.kgd.experiment.application.experiment.service

import com.kgd.common.analytics.BucketAssigner
import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.experiment.application.experiment.port.ExperimentRepositoryPort
import com.kgd.experiment.application.experiment.usecase.AssignBucketUseCase
import com.kgd.experiment.application.experiment.usecase.ChangeExperimentStatusUseCase
import com.kgd.experiment.application.experiment.usecase.CreateExperimentUseCase
import com.kgd.experiment.application.experiment.usecase.GetExperimentUseCase
import com.kgd.experiment.application.experiment.usecase.ListExperimentsUseCase
import com.kgd.experiment.domain.model.Experiment
import com.kgd.experiment.domain.model.ExperimentStatus
import org.springframework.stereotype.Service

@Service
class ExperimentService(
    private val repository: ExperimentRepositoryPort
) : CreateExperimentUseCase, GetExperimentUseCase, ListExperimentsUseCase, ChangeExperimentStatusUseCase, AssignBucketUseCase {

    override fun execute(experiment: Experiment): Experiment = repository.save(experiment)

    override fun execute(id: Long): Experiment =
        repository.findById(id) ?: throw BusinessException(ErrorCode.NOT_FOUND)

    override fun execute(): List<Experiment> = repository.findAll()

    override fun execute(command: ChangeExperimentStatusUseCase.Command): Experiment {
        val experiment = repository.findById(command.id)
            ?: throw BusinessException(ErrorCode.NOT_FOUND)
        return repository.save(experiment.changeStatus(command.status))
    }

    override fun execute(command: AssignBucketUseCase.Command): String {
        val experiment = repository.findById(command.experimentId)
            ?: throw BusinessException(ErrorCode.NOT_FOUND)

        if (experiment.status != ExperimentStatus.RUNNING) {
            throw BusinessException(ErrorCode.INVALID_INPUT)
        }

        val variantWeights = experiment.variants.map { it.name to it.weight }
        return BucketAssigner.assign(command.userId, command.experimentId, variantWeights)
    }
}
