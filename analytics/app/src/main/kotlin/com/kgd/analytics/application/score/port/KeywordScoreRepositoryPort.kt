package com.kgd.analytics.application.score.port

import com.kgd.analytics.domain.model.KeywordScore

interface KeywordScoreRepositoryPort {
    fun save(score: KeywordScore)
    fun findByKeyword(keyword: String): KeywordScore?
}
