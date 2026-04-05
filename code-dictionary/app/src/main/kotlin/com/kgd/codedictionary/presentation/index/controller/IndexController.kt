package com.kgd.codedictionary.presentation.index.controller

import com.kgd.codedictionary.application.index.dto.IndexStatusDto
import com.kgd.codedictionary.application.index.service.IndexService
import com.kgd.codedictionary.application.sync.service.SyncService
import com.kgd.common.response.ApiResponse
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/index")
class IndexController(
    private val syncService: SyncService,
    private val indexService: IndexService
) {

    @PostMapping("/sync")
    fun syncToOpenSearch(): ResponseEntity<ApiResponse<String>> {
        syncService.syncAllToOpenSearch()
        return ResponseEntity.ok(ApiResponse.success("동기화 완료"))
    }

    @GetMapping("/status")
    fun getStatus(): ResponseEntity<ApiResponse<IndexStatusDto>> {
        val count = indexService.count()
        return ResponseEntity.ok(ApiResponse.success(IndexStatusDto(totalIndexed = count)))
    }
}
