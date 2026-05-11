package com.kgd.search.domain.product.port

import com.kgd.search.domain.product.model.ProductDocument
import com.kgd.search.domain.product.model.ScoredProductDocument
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable

interface ProductSearchPort {
    fun search(keyword: String, pageable: Pageable): Page<ProductDocument>

    /**
     * ES `_score` 를 동봉해 반환. application 레이어의 reranker (e.g. ThompsonReranker)
     * 가 esScore 를 hybrid 계산에 사용한다. 기본 구현은 score 0.0 으로 wrap — 어댑터가 override.
     */
    fun searchScored(keyword: String, pageable: Pageable): Page<ScoredProductDocument> =
        search(keyword, pageable).map { ScoredProductDocument(it, 0.0) }
}
