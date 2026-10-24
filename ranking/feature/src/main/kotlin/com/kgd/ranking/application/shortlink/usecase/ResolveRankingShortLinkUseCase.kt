package com.kgd.ranking.application.shortlink.usecase

/** 랭킹 고정 별칭(`/r/cafe`)의 302 목적지. 응답은 컨트롤러가 만든다. */
interface ResolveRankingShortLinkUseCase {

    fun cafe(): String
}
