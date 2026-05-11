package com.kgd.search.application.product.service

import com.kgd.search.application.product.usecase.SearchProductUseCase
import com.kgd.search.bandit.ThompsonReranker
import com.kgd.search.domain.product.port.ProductSearchPort
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import java.util.UUID

@Service
class SearchProductService(
    private val searchPort: ProductSearchPort,
    private val thompsonReranker: ThompsonReranker
) : SearchProductUseCase {

    override fun execute(query: SearchProductUseCase.Query): SearchProductUseCase.Result {
        val pageable = PageRequest.of(query.page, query.size)
        val scored = searchPort.searchScored(query.keyword, pageable)

        val rerankedPairs = thompsonReranker.rerank(
            scored.content.map { it.document to it.esScore }
        )

        val products = rerankedPairs.mapIndexed { idx, (doc, _) ->
            SearchProductUseCase.ProductSearchResult(
                id = doc.id,
                name = doc.name,
                price = doc.price,
                status = doc.status,
                categoryId = doc.categoryId,
                position = pageable.pageNumber * pageable.pageSize + idx
            )
        }

        return SearchProductUseCase.Result(
            searchId = UUID.randomUUID().toString(),
            products = products,
            totalElements = scored.totalElements,
            totalPages = scored.totalPages,
            currentPage = scored.number
        )
    }
}
