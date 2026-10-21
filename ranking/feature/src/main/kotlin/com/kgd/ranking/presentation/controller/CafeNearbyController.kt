package com.kgd.ranking.presentation.controller

import com.kgd.common.response.ApiResponse
import com.kgd.ranking.application.cafe.dto.*
import com.kgd.ranking.application.cafe.usecase.*
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order

@RestController
@RequestMapping("/api/v1/ranking/cafe")
class CafeNearbyController(private val nearby: GetCafeNearbyUseCase) {
    private val inFlight = java.util.concurrent.Semaphore(16)
    @GetMapping("/capability") fun capability() = ApiResponse.success(nearby.capability())
    @GetMapping("/areas") fun areas(@RequestParam(required = false) parent: String?) = ApiResponse.success(nearby.areas(parent))
    @PostMapping("/nearby-search")
    fun search(@RequestBody request: CafeNearbyRequest): ResponseEntity<ApiResponse<CafeNearbyResult>> {
        if (!inFlight.tryAcquire()) throw CafeNearbyBusy()
        return try { ResponseEntity.ok().header("Cache-Control", "no-store").body(ApiResponse.success(nearby.search(request))) }
        finally { inFlight.release() }
    }
}
@RestController
@RequestMapping("/internal/ranking/cafe/stores")
class CafeStoreInternalController(private val sync: SyncCafeStoresUseCase) {
    @PostMapping("/bulk") fun bulk(@RequestBody request: CafeStoreSnapshot) = ApiResponse.success(mapOf("received" to sync.sync(request)))
}

/** Never forward a parser, validation or persistence exception (which may carry request values). */
@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(assignableTypes = [CafeNearbyController::class])
class CafeNearbyErrors {
    @ExceptionHandler(Exception::class)
    fun error(error: Exception): ResponseEntity<ApiResponse<Nothing>> {
        val status = when (error) {
            is CafeNearbyBusy -> 429
            is CafeNearbyUnavailable -> 503
            is CafeNearbyNotFound -> 404
            is CafeNearbyInvalid, is IllegalArgumentException, is org.springframework.http.converter.HttpMessageNotReadableException -> 400
            else -> 503
        }
        return ResponseEntity.status(status).header("Cache-Control", "no-store").body(ApiResponse.error("NEARBY_UNAVAILABLE", if (status == 400) "주변 검색 조건을 확인해 주세요" else "주변 정보를 조회할 수 없습니다"))
    }
}
