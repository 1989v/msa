package com.kgd.ranking.application.shortlink.service

import com.kgd.common.shortlink.ShortLinkProperties
import com.kgd.ranking.application.shortlink.usecase.ResolveRankingShortLinkUseCase
import org.springframework.stereotype.Service

/** 목적지 호스트는 설정에서만 얻는다 — 요청 헤더로 만들면 오픈 리다이렉트가 된다. */
@Service
class RankingShortLinkService(properties: ShortLinkProperties) : ResolveRankingShortLinkUseCase {

    private val origin = properties.rankOrigin.trimEnd('/')

    override fun cafe(): String = "$origin/cafe"

    override fun home(): String = "$origin/"
}
