package com.kgd.quant.presentation.controller

import com.kgd.common.response.ApiResponse
import com.kgd.quant.application.learn.IndicatorContentUseCase
import com.kgd.quant.domain.learn.ContentId
import com.kgd.quant.domain.learn.IndicatorCategory
import com.kgd.quant.domain.learn.IndicatorContent
import com.kgd.quant.domain.learn.IndicatorExample
import com.kgd.quant.domain.learn.Slug
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException
import java.util.UUID

/**
 * LearnController — /api/v1/learn/indicators/... (ADR-0033 Phase 1).
 *
 * Phase 1 ROLE_ADMIN 가드는 단순 헤더 기반(가짜) — auth 통합은 Phase 2.
 * 헤더 X-Role 이 ADMIN 일 때만 write 허용 (gateway 가 JWT roles 를 헤더로 주입한다고 가정).
 */
@RestController
@RequestMapping("/api/v1/learn/indicators")
class LearnController(
    private val useCase: IndicatorContentUseCase,
) {
    @GetMapping
    suspend fun list(
        @RequestParam(required = false) category: IndicatorCategory?,
    ): ApiResponse<List<ContentResponse>> {
        val items = useCase.listPublished(category)
        return ApiResponse.success(items.map { it.toResponse() })
    }

    @GetMapping("/{slug}")
    suspend fun bySlug(
        @PathVariable slug: String,
    ): ApiResponse<ContentResponse> {
        val item = useCase.bySlug(Slug(slug))
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "indicator content not found: $slug")
        return ApiResponse.success(item.toResponse())
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    suspend fun create(
        @com.kgd.quant.presentation.resolver.RolesHeader roles: Set<String>,
        @RequestBody request: CreateRequest,
    ): ApiResponse<ContentResponse> {
        ensureAdmin(roles)
        val created = useCase.create(
            IndicatorContentUseCase.CreateInput(
                slug = Slug(request.slug),
                title = request.title,
                category = request.category,
                summary = request.summary,
                bodyMarkdown = request.bodyMarkdown,
                formulaTeX = request.formulaTeX,
                examples = request.examples.map { it.toDomain() },
                publish = request.publish,
            )
        )
        return ApiResponse.success(created.toResponse())
    }

    @PutMapping("/{id}")
    suspend fun update(
        @com.kgd.quant.presentation.resolver.RolesHeader roles: Set<String>,
        @PathVariable id: String,
        @RequestBody request: UpdateRequest,
    ): ApiResponse<ContentResponse> {
        ensureAdmin(roles)
        val updated = useCase.update(
            ContentId(UUID.fromString(id)),
            IndicatorContentUseCase.UpdateInput(
                title = request.title,
                category = request.category,
                summary = request.summary,
                bodyMarkdown = request.bodyMarkdown,
                formulaTeX = request.formulaTeX,
                examples = request.examples?.map { it.toDomain() },
                publish = request.publish,
            )
        )
        return ApiResponse.success(updated.toResponse())
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    suspend fun delete(
        @com.kgd.quant.presentation.resolver.RolesHeader roles: Set<String>,
        @PathVariable id: String,
    ) {
        ensureAdmin(roles)
        useCase.delete(ContentId(UUID.fromString(id)))
    }

    private fun ensureAdmin(roles: Set<String>) {
        // gateway AuthenticationGatewayFilter 가 JWT roles 를 X-User-Roles 콤마구분으로 주입.
        // 운영에선 헤더 위변조 방지가 gateway 측 책임 (JWT 미통과 요청은 401 차단).
        if ("ROLE_ADMIN" !in roles) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "ROLE_ADMIN required")
        }
    }

    data class CreateRequest(
        val slug: String,
        val title: String,
        val category: IndicatorCategory,
        val summary: String,
        val bodyMarkdown: String,
        val formulaTeX: String?,
        val examples: List<ExampleDto> = emptyList(),
        val publish: Boolean = false,
    )

    data class UpdateRequest(
        val title: String? = null,
        val category: IndicatorCategory? = null,
        val summary: String? = null,
        val bodyMarkdown: String? = null,
        val formulaTeX: String? = null,
        val examples: List<ExampleDto>? = null,
        val publish: Boolean? = null,
    )

    data class ExampleDto(
        val label: String,
        val assetCode: String,
        val periodStart: String,
        val periodEnd: String,
        val description: String,
    ) {
        fun toDomain(): IndicatorExample = IndicatorExample(
            label = label,
            assetCode = com.kgd.quant.domain.asset.AssetCode(assetCode),
            periodStart = java.time.LocalDate.parse(periodStart),
            periodEnd = java.time.LocalDate.parse(periodEnd),
            description = description,
        )
    }

    data class ContentResponse(
        val id: String,
        val slug: String,
        val title: String,
        val category: IndicatorCategory,
        val summary: String,
        val bodyMarkdown: String,
        val formulaTeX: String?,
        val examples: List<ExampleDto>,
        val publishedAt: String?,
    )

    private fun IndicatorContent.toResponse() = ContentResponse(
        id = id.value.toString(),
        slug = slug.value,
        title = title,
        category = category,
        summary = summary,
        bodyMarkdown = bodyMarkdown,
        formulaTeX = formulaTeX,
        examples = examples.map {
            ExampleDto(
                label = it.label,
                assetCode = it.assetCode.value,
                periodStart = it.periodStart.toString(),
                periodEnd = it.periodEnd.toString(),
                description = it.description,
            )
        },
        publishedAt = publishedAt?.toString(),
    )
}
