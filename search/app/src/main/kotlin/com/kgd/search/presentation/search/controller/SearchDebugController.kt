package com.kgd.search.presentation.search.controller

import com.kgd.common.response.ApiResponse
import com.kgd.search.application.debug.usecase.DebugSearchUseCase
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException

/**
 * ADR-0050 Phase 4 UI — 검색 디버그/실험 API.
 *
 * - GET  /api/v1/search/debug?query=&variant=&topK=&explain=true
 *     score breakdown (popularity / ctr / cvr / gmv / freshness / bandit / final) 반환
 * - POST /api/v1/search/debug/raw-query
 *     관리자가 직접 ES Native query (JSON) 를 던져서 결과 확인
 * - GET  /api/v1/search/debug/fields
 *     ProductSearchDocument 필드 메타 (admin-fe query builder 토글 생성용)
 *
 * 권한: ADMIN. Gateway 측 인증 필터 + 아래 requireAdmin.
 */
@RestController
@RequestMapping("/api/v1/search/debug")
class SearchDebugController(
    private val debugSearch: DebugSearchUseCase,
) {

    @GetMapping
    fun debug(
        @RequestParam query: String,
        @RequestParam(defaultValue = "live") variant: String,
        @RequestParam(defaultValue = "20") topK: Int,
        @RequestParam(defaultValue = "false") explain: Boolean,
        @RequestHeader(name = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<DebugSearchUseCase.DebugResult> {
        requireAdmin(roles)
        return ApiResponse.success(debugSearch.debug(query, variant, topK, explain))
    }

    @PostMapping("/raw-query")
    fun rawQuery(
        @RequestBody request: RawQueryRequest,
        @RequestHeader(name = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<DebugSearchUseCase.RawQueryResult> {
        requireAdmin(roles)
        return ApiResponse.success(
            debugSearch.rawQuery(
                DebugSearchUseCase.RawQueryCommand(
                    indexName = request.indexName,
                    query = request.query,
                    topK = request.topK,
                    functionScores = request.functionScores,
                ),
            ),
        )
    }

    @GetMapping("/fields")
    fun fields(
        @RequestHeader(name = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<List<DebugSearchUseCase.FieldMeta>> {
        requireAdmin(roles)
        return ApiResponse.success(debugSearch.supportedFields())
    }

    /**
     * Gateway 의 AuthenticationGatewayFilter 가 X-User-Roles 헤더로 역할을 전달 (CSV).
     * ADMIN 미포함 시 403.
     */
    private fun requireAdmin(roles: String?) {
        val parsed = roles?.split(",")?.map { it.trim() } ?: emptyList()
        if ("ROLE_ADMIN" !in parsed && "ADMIN" !in parsed) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "ADMIN role required")
        }
    }

    data class RawQueryRequest(
        val indexName: String = "products",
        val query: String,
        val topK: Int = 20,
        val functionScores: List<DebugSearchUseCase.FunctionScoreSpec> = emptyList(),
    )
}
