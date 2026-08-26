package com.kgd.search.application.debug.service

import com.kgd.search.application.debug.port.SearchDebugPort
import com.kgd.search.application.debug.usecase.DebugSearchUseCase
import org.springframework.stereotype.Service

/**
 * 허용 인덱스·topK 한도를 여기서 접는다 — 컨트롤러가 그대로 넘긴 값으로 클러스터를 훑지 않도록.
 */
@Service
class SearchDebugService(
    private val searchDebugPort: SearchDebugPort,
) : DebugSearchUseCase {

    override fun debug(query: String, variant: String, topK: Int, explain: Boolean): DebugSearchUseCase.DebugResult =
        searchDebugPort.debug(query, variant, topK.coerceIn(1, MAX_TOP_K))
            .copy(explainEnabled = explain)

    override fun rawQuery(command: DebugSearchUseCase.RawQueryCommand): DebugSearchUseCase.RawQueryResult {
        require(command.indexName in ALLOWED_INDICES) { "indexName not allowed: ${command.indexName}" }
        return searchDebugPort.rawQuery(command.copy(topK = command.topK.coerceIn(1, MAX_TOP_K)))
    }

    override fun supportedFields(): List<DebugSearchUseCase.FieldMeta> = SUPPORTED_FIELDS

    private companion object {
        const val MAX_TOP_K = 200
        val ALLOWED_INDICES = setOf("products")

        val SUPPORTED_FIELDS = listOf(
            DebugSearchUseCase.FieldMeta("name", "text", listOf("match")),
            DebugSearchUseCase.FieldMeta("status", "keyword", listOf("term")),
            DebugSearchUseCase.FieldMeta("categoryId", "keyword", listOf("term")),
            DebugSearchUseCase.FieldMeta("price", "double", listOf("range", "fieldValueFactor")),
            DebugSearchUseCase.FieldMeta("popularityScore", "double", listOf("fieldValueFactor")),
            DebugSearchUseCase.FieldMeta("ctr", "double", listOf("fieldValueFactor")),
            DebugSearchUseCase.FieldMeta("cvr", "double", listOf("fieldValueFactor")),
            DebugSearchUseCase.FieldMeta("gmv7d", "double", listOf("fieldValueFactor")),
            DebugSearchUseCase.FieldMeta("gmv30d", "double", listOf("fieldValueFactor")),
            DebugSearchUseCase.FieldMeta("createdAt", "date", listOf("range", "gauss")),
        )
    }
}
