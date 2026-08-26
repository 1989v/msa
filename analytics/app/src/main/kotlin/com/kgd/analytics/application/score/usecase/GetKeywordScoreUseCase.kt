package com.kgd.analytics.application.score.usecase

import com.kgd.analytics.domain.model.KeywordScore

interface GetKeywordScoreUseCase {
    fun execute(keyword: String): KeywordScore?
}
