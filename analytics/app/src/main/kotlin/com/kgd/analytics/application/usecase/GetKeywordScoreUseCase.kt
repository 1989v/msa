package com.kgd.analytics.application.usecase

import com.kgd.analytics.domain.model.KeywordScore
import com.kgd.analytics.domain.port.KeywordScoreRepositoryPort
import com.kgd.analytics.domain.port.ScoreCachePort
import org.springframework.stereotype.Service

@Service
class GetKeywordScoreUseCase(
    private val cache: ScoreCachePort,
    private val repository: KeywordScoreRepositoryPort
) {
    fun execute(keyword: String): KeywordScore? {
        cache.getKeywordScore(keyword)?.let { return it }
        return repository.findByKeyword(keyword)?.also { cache.cacheKeywordScore(it) }
    }
}
