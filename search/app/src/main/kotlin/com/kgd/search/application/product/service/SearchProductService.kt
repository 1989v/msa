package com.kgd.search.application.product.service

import com.kgd.search.application.product.port.SearchVariantPort
import com.kgd.search.application.product.usecase.SearchProductUseCase
import com.kgd.search.application.product.usecase.SuggestProductUseCase
import com.kgd.search.bandit.SellerDiversityReranker
import com.kgd.search.bandit.ThompsonReranker
import com.kgd.search.domain.product.port.ProductSearchPort
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import java.util.UUID

@Service
class SearchProductService(
    private val searchPort: ProductSearchPort,
    private val thompsonReranker: ThompsonReranker,
    private val sellerDiversityReranker: SellerDiversityReranker,
    private val variantPort: SearchVariantPort,
) : SearchProductUseCase, SuggestProductUseCase {

    override fun execute(query: SearchProductUseCase.Query): SearchProductUseCase.Result {
        val pageable = PageRequest.of(query.page, query.size)
        val variant = variantPort.resolveVariant(query.userId)
        val filters = ProductSearchPort.Filters(minKcal = query.minKcal, maxKcal = query.maxKcal)
        val scored = searchPort.searchScored(query.keyword, pageable, variant, filters)

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
                energyKcal = doc.energyKcal,
                carbohydrateG = doc.carbohydrateG,
                proteinG = doc.proteinG,
                fatG = doc.fatG,
                sugarG = doc.sugarG,
                sodiumMg = doc.sodiumMg,
                ingredients = doc.ingredients,
                originCountry = doc.originCountry,
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
}
