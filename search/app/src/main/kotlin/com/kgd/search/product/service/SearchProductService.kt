package com.kgd.search.application.product.service

import com.kgd.search.application.product.usecase.SearchProductUseCase
import com.kgd.search.application.product.usecase.SuggestProductUseCase
import com.kgd.search.bandit.SellerDiversityReranker
import com.kgd.search.bandit.ThompsonReranker
import com.kgd.search.domain.product.port.ProductSearchPort
import com.kgd.search.infrastructure.client.SearchExperimentClient
import com.kgd.search.infrastructure.client.SearchExperimentProperties
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import java.util.UUID

@Service
class SearchProductService(
    private val searchPort: ProductSearchPort,
    private val thompsonReranker: ThompsonReranker,
    private val sellerDiversityReranker: SellerDiversityReranker,
    private val experimentClient: SearchExperimentClient,
    private val experimentProperties: SearchExperimentProperties,
) : SearchProductUseCase, SuggestProductUseCase {

    override fun execute(query: SearchProductUseCase.Query): SearchProductUseCase.Result {
        val pageable = PageRequest.of(query.page, query.size)
        val variant = resolveVariant(query.userId)
        val scored = searchPort.searchScored(query.keyword, pageable, variant)

        val afterThompson = thompsonReranker.rerank(
            scored.content.map { it.document to it.esScore }
        )
        val rerankedPairs = sellerDiversityReranker.rerank(afterThompson)

        val products = rerankedPairs.mapIndexed { idx, (doc, _) ->
            SearchProductUseCase.ProductSearchResult(
                id = doc.id,
                name = doc.name,
                price = doc.price,
                status = doc.status,
                categoryId = doc.categoryId,
                category = doc.category,
                description = doc.description,
                position = pageable.pageNumber * pageable.pageSize + idx
            )
        }

        return SearchProductUseCase.Result(
            searchId = UUID.randomUUID().toString(),
            products = products,
            totalElements = scored.totalElements,
            totalPages = scored.totalPages,
            currentPage = scored.number,
            variant = variant
        )
    }

    override fun execute(prefix: String, size: Int): List<SuggestProductUseCase.Suggestion> =
        searchPort.suggest(prefix, size).map { SuggestProductUseCase.Suggestion(id = it.id, name = it.name) }

    /**
     * 온라인 A/B variant 해석. 실험 비활성 또는 비로그인 사용자는 미참여 (null = 기본 ranking).
     * variant 키가 `search.ranking-variants.variants` 에 없으면 (control 등) 어댑터가
     * 기본 ranking 으로 fallback 하되, 결과에는 variant 가 그대로 태깅되어 분석 차원으로 쓰인다.
     */
    private fun resolveVariant(userId: String?): String? {
        if (!experimentProperties.enabled || userId.isNullOrBlank()) return null
        return experimentClient.getVariant(experimentProperties.id, userId)
    }
}
