package com.kgd.place.application.market.service

import com.kgd.place.application.market.port.MarketSearchPort
import com.kgd.place.application.market.usecase.SearchMarketsUseCase
import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
@Transactional(transactionManager = "placeTransactionManager", readOnly = true)
class MarketSearchService(private val search: MarketSearchPort) : SearchMarketsUseCase {
    override fun search(query: String, lang: String, page: Int, size: Int): SearchMarketsUseCase.Result {
        val normalized = MarketDishDictionary.normalize(query)
        if (normalized.length > 50) throw BusinessException(ErrorCode.INVALID_INPUT, "q must contain at most 50 characters")
        if (lang != "ko" && lang != "en") throw BusinessException(ErrorCode.INVALID_INPUT, "lang must be ko or en")
        if (page < 0 || size !in 1..50) throw BusinessException(ErrorCode.INVALID_INPUT,
            "page must be nonnegative and size must be between 1 and 50")
        return search.search(normalized, lang, page, size)
    }

    override fun contentIds(): List<String> = search.contentIds()
}
