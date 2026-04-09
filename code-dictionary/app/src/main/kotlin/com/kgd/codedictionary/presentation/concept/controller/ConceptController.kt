package com.kgd.codedictionary.presentation.concept.controller

import com.kgd.codedictionary.application.concept.dto.ConceptDetailDto
import com.kgd.codedictionary.application.concept.dto.ConceptResultDto
import com.kgd.codedictionary.application.concept.service.ConceptService
import com.kgd.codedictionary.domain.concept.model.ConceptCategory
import com.kgd.codedictionary.domain.concept.model.ConceptLevel
import com.kgd.codedictionary.presentation.concept.dto.ConceptCreateRequest
import com.kgd.codedictionary.presentation.concept.dto.ConceptUpdateRequest
import com.kgd.common.response.ApiResponse
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/v1/concepts")
class ConceptController(
    private val conceptService: ConceptService
) {

    @GetMapping
    fun list(
        @RequestParam(required = false) category: String?,
        @RequestParam(required = false) level: String?,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int
    ): ApiResponse<Page<ConceptResultDto>> {
        val parsedCategory = category?.let { ConceptCategory.valueOf(it.uppercase()) }
        val parsedLevel = level?.let { ConceptLevel.valueOf(it.uppercase()) }
        val result = conceptService.findAll(parsedCategory, parsedLevel, PageRequest.of(page, size))
        return ApiResponse.success(result)
    }

    @GetMapping("/{id}")
    fun getById(@PathVariable id: Long): ApiResponse<ConceptResultDto> {
        val result = conceptService.findById(id)
        return ApiResponse.success(result)
    }

    @GetMapping("/by-concept-id/{conceptId}")
    fun getByConceptId(@PathVariable conceptId: String): ApiResponse<ConceptDetailDto> {
        val result = conceptService.findByConceptIdDetail(conceptId)
        return ApiResponse.success(result)
    }

    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping
    fun create(@RequestBody request: ConceptCreateRequest): ApiResponse<ConceptResultDto> {
        val result = conceptService.create(request.toCommand())
        return ApiResponse.success(result)
    }

    @PutMapping("/{id}")
    fun update(
        @PathVariable id: Long,
        @RequestBody request: ConceptUpdateRequest
    ): ApiResponse<ConceptResultDto> {
        val result = conceptService.update(id, request.toCommand())
        return ApiResponse.success(result)
    }

    @ResponseStatus(HttpStatus.NO_CONTENT)
    @DeleteMapping("/{id}")
    fun delete(@PathVariable id: Long) {
        conceptService.delete(id)
    }
}
