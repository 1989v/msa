package com.kgd.experiment.presentation.controller

import com.kgd.common.response.ApiResponse
import com.kgd.experiment.application.experiment.dto.ExperimentResultDto
import com.kgd.experiment.application.experiment.usecase.AssignBucketUseCase
import com.kgd.experiment.application.experiment.usecase.ChangeExperimentStatusUseCase
import com.kgd.experiment.application.experiment.usecase.CreateExperimentUseCase
import com.kgd.experiment.application.experiment.usecase.GetExperimentResultsUseCase
import com.kgd.experiment.application.experiment.usecase.GetExperimentUseCase
import com.kgd.experiment.application.experiment.usecase.ListExperimentsUseCase
import com.kgd.experiment.presentation.dto.*
import jakarta.validation.Valid
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/v1/experiments")
class ExperimentController(
    private val createExperiment: CreateExperimentUseCase,
    private val getExperiment: GetExperimentUseCase,
    private val listExperiments: ListExperimentsUseCase,
    private val changeStatus: ChangeExperimentStatusUseCase,
    private val assignBucket: AssignBucketUseCase,
    private val getResults: GetExperimentResultsUseCase
) {
    @PostMapping
    fun create(@Valid @RequestBody request: CreateExperimentRequest): ApiResponse<ExperimentResponse> {
        val experiment = createExperiment.execute(request.toDomain())
        return ApiResponse.success(ExperimentResponse.from(experiment))
    }

    @GetMapping
    fun list(): ApiResponse<List<ExperimentResponse>> {
        val experiments = listExperiments.execute()
        return ApiResponse.success(experiments.map { ExperimentResponse.from(it) })
    }

    @GetMapping("/{id}")
    fun get(@PathVariable id: Long): ApiResponse<ExperimentResponse> {
        val experiment = getExperiment.execute(id)
        return ApiResponse.success(ExperimentResponse.from(experiment))
    }

    @PatchMapping("/{id}/status")
    fun changeStatus(
        @PathVariable id: Long,
        @RequestBody request: ChangeStatusRequest
    ): ApiResponse<ExperimentResponse> {
        val experiment = changeStatus.execute(ChangeExperimentStatusUseCase.Command(id, request.status))
        return ApiResponse.success(ExperimentResponse.from(experiment))
    }

    @GetMapping("/{id}/assignment")
    fun assign(
        @PathVariable id: Long,
        @RequestParam userId: String
    ): ApiResponse<AssignmentResponse> {
        val variant = assignBucket.execute(AssignBucketUseCase.Command(id, userId))
        return ApiResponse.success(AssignmentResponse(id, userId, variant))
    }

    @GetMapping("/{id}/results")
    fun getResults(@PathVariable id: Long): ApiResponse<ExperimentResultDto> {
        val results = getResults.execute(id)
        return ApiResponse.success(results)
    }
}
