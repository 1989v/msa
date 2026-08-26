package com.kgd.codedictionary.presentation.index.controller

import com.kgd.codedictionary.application.index.dto.CreateIndexCommand
import com.kgd.codedictionary.application.index.dto.IndexResultDto
import com.kgd.codedictionary.application.index.dto.IndexStatusDto
import com.kgd.codedictionary.application.index.usecase.ManageConceptIndexUseCase
import com.kgd.codedictionary.application.sync.dto.IndexSyncJob
import com.kgd.codedictionary.application.sync.usecase.SyncConceptIndexUseCase
import com.kgd.common.response.ApiResponse
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/index")
class IndexController(
    private val syncIndex: SyncConceptIndexUseCase,
    private val manageIndex: ManageConceptIndexUseCase
) {

    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping
    fun create(@RequestBody command: CreateIndexCommand): ApiResponse<IndexResultDto> {
        val result = manageIndex.create(command)
        return ApiResponse.success(result)
    }

    @PostMapping("/sync")
    fun submitSync(): ApiResponse<IndexSyncJob> = ApiResponse.success(syncIndex.submit())

    @GetMapping("/sync/{jobId}")
    fun getSyncJob(@PathVariable jobId: String): ApiResponse<IndexSyncJob> {
        val job = syncIndex.get(jobId)
            ?: return ApiResponse.success(
                IndexSyncJob(
                    jobId = jobId,
                    status = com.kgd.codedictionary.application.sync.dto.IndexSyncStatus.FAILED,
                    startedAt = java.time.Instant.EPOCH,
                    error = "job not found"
                )
            )
        return ApiResponse.success(job)
    }

    @GetMapping("/status")
    fun getStatus(): ApiResponse<IndexStatusDto> {
        val count = manageIndex.count()
        return ApiResponse.success(IndexStatusDto(totalIndexed = count))
    }
}
