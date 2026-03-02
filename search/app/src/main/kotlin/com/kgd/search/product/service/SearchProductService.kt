package com.kgd.search.application.product.service

import com.kgd.search.application.product.usecase.SearchProductUseCase
import com.kgd.search.domain.product.port.ProductSearchPort
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service

@Service
class SearchProductService(
    private val searchPort: ProductSearchPort
) : SearchProductUseCase {

    override fun execute(query: SearchProductUseCase.Query): SearchProductUseCase.Result {
        val pageable = PageRequest.of(query.page, query.size)
        val page = searchPort.search(query.keyword, pageable)

        return SearchProductUseCase.Result(
            products = page.content.map {
                SearchProductUseCase.ProductSearchResult(
                    id = it.id,
                    name = it.name,
                    price = it.price,
                    status = it.status
                )
            },
            totalElements = page.totalElements,
            totalPages = page.totalPages,
            currentPage = page.number
        )
    }
}
