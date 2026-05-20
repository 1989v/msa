package com.kgd.analytics.presentation.controller

import com.kgd.analytics.infrastructure.persistence.JudgmentRepositoryAdapter
import com.kgd.analytics.infrastructure.persistence.JudgmentRow
import com.kgd.common.response.ApiResponse
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
 * ADR-0050 Phase 4 — Search judgment 수동 라벨링 API.
 *
 * - POST /api/v1/search/judgments       : 단건 라벨 upsert (source='manual')
 * - GET  /api/v1/search/judgments       : 페이지네이션 조회
 * - GET  /api/v1/search/judgments/queries: query 자동완성용 distinct list
 *
 * 권한: ADMIN. Gateway 의 X-User-Roles 헤더에서 검증.
 */
@RestController
@RequestMapping("/api/v1/search/judgments")
class JudgmentController(
    private val repository: JudgmentRepositoryAdapter
) {

    @PostMapping
    fun upsert(
        @RequestBody body: UpsertRequest,
        @RequestHeader(name = "X-User-Roles", required = false) roles: String?
    ): ApiResponse<Unit> {
        requireAdmin(roles)
        repository.upsertManual(
            query = body.query,
            productId = body.productId,
            relevance = body.relevance,
            weight = body.weight ?: 1.0
        )
        return ApiResponse.success()
    }

    @GetMapping
    fun list(
        @RequestParam(required = false) query: String?,
        @RequestParam(defaultValue = "100") limit: Int,
        @RequestParam(defaultValue = "0") offset: Int,
        @RequestHeader(name = "X-User-Roles", required = false) roles: String?
    ): ApiResponse<List<JudgmentRow>> {
        requireAdmin(roles)
        return ApiResponse.success(repository.list(query, limit.coerceIn(1, 500), offset.coerceAtLeast(0)))
    }

    @GetMapping("/queries")
    fun queries(
        @RequestParam(required = false) prefix: String?,
        @RequestParam(defaultValue = "50") limit: Int,
        @RequestHeader(name = "X-User-Roles", required = false) roles: String?
    ): ApiResponse<List<String>> {
        requireAdmin(roles)
        return ApiResponse.success(repository.distinctQueries(prefix, limit.coerceIn(1, 500)))
    }

    private fun requireAdmin(roles: String?) {
        val parsed = roles?.split(",")?.map { it.trim() } ?: emptyList()
        if ("ROLE_ADMIN" !in parsed && "ADMIN" !in parsed) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "ADMIN role required")
        }
    }

    data class UpsertRequest(
        val query: String,
        val productId: String,
        val relevance: Int,
        val weight: Double? = null
    )
}
