package com.kgd.codedictionary.presentation.concept.controller

import com.kgd.codedictionary.application.concept.dto.ConceptDetailDto
import com.kgd.codedictionary.application.concept.dto.ConceptResultDto
import com.kgd.codedictionary.application.concept.service.ConceptService
import com.kgd.codedictionary.application.graph.dto.CategoryStatsFilter
import com.kgd.codedictionary.application.graph.dto.TreemapDataDto
import com.kgd.codedictionary.application.graph.service.GraphService
import com.kgd.codedictionary.domain.concept.model.ConceptCategory
import com.kgd.codedictionary.domain.concept.model.ConceptLevel
import com.kgd.codedictionary.presentation.concept.dto.ConceptCreateRequest
import com.kgd.codedictionary.presentation.concept.dto.ConceptUpdateRequest
import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.common.response.ApiResponse
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/v1/concepts")
class ConceptController(
    private val conceptService: ConceptService,
    private val graphService: GraphService
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

    /**
     * 트리맵 stats endpoint — spec.md §5.1.
     *
     * - `categories`: comma-separated, 미지정 시 전체 카테고리
     * - `includeZeroIndex`: indexCount=0 concept 포함 여부 (default false)
     * - 알 수 없는 카테고리명 → 400 INVALID_INPUT (common ErrorCode 미존재 → INVALID_INPUT 사용)
     */
    @GetMapping("/stats/treemap")
    fun getTreemapStats(
        @RequestParam(required = false) categories: String?,
        @RequestParam(required = false, defaultValue = "false") includeZeroIndex: Boolean
    ): ApiResponse<TreemapDataDto> {
        val categorySet: Set<String>? = categories
            ?.split(",")
            ?.map { it.trim() }
            ?.filter { it.isNotEmpty() }
            ?.takeIf { it.isNotEmpty() }
            ?.map { it.uppercase() }
            ?.toSet()

        // 입력 검증: 알 수 없는 카테고리명 → 400
        categorySet?.forEach { name ->
            runCatching { ConceptCategory.valueOf(name) }
                .onFailure {
                    throw BusinessException(
                        errorCode = ErrorCode.INVALID_INPUT,
                        message = "알 수 없는 카테고리: $name"
                    )
                }
        }

        val filter = CategoryStatsFilter(
            categories = categorySet,
            includeZeroIndex = includeZeroIndex
        )
        return ApiResponse.success(graphService.getCategoryStats(filter))
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
