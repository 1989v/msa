package com.kgd.quant.presentation.controller

import com.kgd.common.response.ApiResponse
import com.kgd.quant.application.asset.catalog.AssetCatalogUseCase
import com.kgd.quant.domain.asset.catalog.AssetCatalog
import com.kgd.quant.domain.asset.catalog.AssetCatalogId
import com.kgd.quant.domain.asset.catalog.AssetClass
import com.kgd.quant.domain.asset.catalog.AssetSource
import com.kgd.quant.presentation.resolver.RolesHeader
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException
import java.util.UUID

/**
 * AssetCatalogController — 자산 카탈로그 read(공개) + admin CRUD.
 *
 * Phase 1.5 — ingest scheduler 가 `GET /api/v1/quant/assets?activeOnly=true` 로 fetch.
 * 어드민 write 는 ROLE_ADMIN (LearnController 와 동일 패턴).
 */
@RestController
@RequestMapping("/api/v1/quant/assets")
class AssetCatalogController(
    private val useCase: AssetCatalogUseCase,
) {
    @GetMapping
    suspend fun list(
        @RequestParam(name = "activeOnly", defaultValue = "false") activeOnly: Boolean,
    ): ApiResponse<List<AssetCatalogResponse>> {
        val items = useCase.list(activeOnly)
        return ApiResponse.success(items.map { it.toResponse() })
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    suspend fun create(
        @RolesHeader roles: Set<String>,
        @RequestBody request: CreateRequest,
    ): ApiResponse<AssetCatalogResponse> {
        ensureAdmin(roles)
        val created = useCase.create(
            AssetCatalogUseCase.CreateInput(
                assetCode = request.assetCode,
                assetClass = AssetClass.valueOf(request.assetClass),
                source = AssetSource.ofKey(request.source),
                displayName = request.displayName,
                active = request.active,
                sortOrder = request.sortOrder,
            )
        )
        return ApiResponse.success(created.toResponse())
    }

    @PatchMapping("/{id}")
    suspend fun update(
        @RolesHeader roles: Set<String>,
        @PathVariable id: String,
        @RequestBody request: UpdateRequest,
    ): ApiResponse<AssetCatalogResponse> {
        ensureAdmin(roles)
        val updated = useCase.update(
            AssetCatalogId(UUID.fromString(id)),
            AssetCatalogUseCase.UpdateInput(
                displayName = request.displayName,
                source = request.source?.let { AssetSource.ofKey(it) },
                active = request.active,
                sortOrder = request.sortOrder,
            )
        )
        return ApiResponse.success(updated.toResponse())
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    suspend fun delete(
        @RolesHeader roles: Set<String>,
        @PathVariable id: String,
    ) {
        ensureAdmin(roles)
        useCase.delete(AssetCatalogId(UUID.fromString(id)))
    }

    private fun ensureAdmin(roles: Set<String>) {
        if ("ROLE_ADMIN" !in roles) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "ROLE_ADMIN required")
        }
    }

    data class CreateRequest(
        val assetCode: String,
        val assetClass: String,        // CRYPTO / STOCK_KR / STOCK_US
        val source: String,            // yfinance / fdr
        val displayName: String,
        val active: Boolean = true,
        val sortOrder: Int = 0,
    )

    data class UpdateRequest(
        val displayName: String? = null,
        val source: String? = null,
        val active: Boolean? = null,
        val sortOrder: Int? = null,
    )

    data class AssetCatalogResponse(
        val id: String,
        val assetCode: String,
        val assetClass: String,
        val source: String,
        val displayName: String,
        val active: Boolean,
        val sortOrder: Int,
        val createdAt: String,
        val updatedAt: String,
    )

    private fun AssetCatalog.toResponse(): AssetCatalogResponse = AssetCatalogResponse(
        id = id.value.toString(),
        assetCode = assetCode,
        assetClass = assetClass.name,
        source = source.key,
        displayName = displayName,
        active = active,
        sortOrder = sortOrder,
        createdAt = createdAt.toString(),
        updatedAt = updatedAt.toString(),
    )
}
