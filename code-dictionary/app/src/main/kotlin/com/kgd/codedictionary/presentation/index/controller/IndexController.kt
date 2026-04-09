package com.kgd.codedictionary.presentation.index.controller

import com.kgd.codedictionary.application.index.dto.CreateIndexCommand
import com.kgd.codedictionary.application.index.dto.IndexResultDto
import com.kgd.codedictionary.application.index.dto.IndexStatusDto
import com.kgd.codedictionary.application.index.service.IndexService
import com.kgd.codedictionary.application.sync.service.SyncService
import com.kgd.common.response.ApiResponse
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/index")
class IndexController(
    private val syncService: SyncService,
    private val indexService: IndexService
) {

    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping
    fun create(@RequestBody command: CreateIndexCommand): ApiResponse<IndexResultDto> {
        val result = indexService.create(command)
        return ApiResponse.success(result)
    }

    @PostMapping("/sync")
    fun syncToOpenSearch(): ApiResponse<String> {
        syncService.syncAllToOpenSearch()
        return ApiResponse.success("동기화 완료")
    }

    @GetMapping("/status")
    fun getStatus(): ApiResponse<IndexStatusDto> {
        val count = indexService.count()
        return ApiResponse.success(IndexStatusDto(totalIndexed = count))
    }
}
