package com.kgd.ranking.presentation.controller

import com.kgd.common.shortlink.ShortLinkRedirects
import com.kgd.ranking.application.shortlink.usecase.ResolveRankingShortLinkUseCase
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController

/** 랭킹 공유용 단축 주소 `1989v.com/rk/{별칭}` (ADR-0106 개정). 코드 해석 없이 정해진 페이지로만 보낸다. */
@RestController
class RankingShortLinkController(private val resolve: ResolveRankingShortLinkUseCase) {

    @GetMapping("/rk/cafe")
    fun cafe(): ResponseEntity<Void> = ShortLinkRedirects.redirect(resolve.cafe())

    @GetMapping("/rk", "/rk/**")
    fun home(): ResponseEntity<Void> = ShortLinkRedirects.redirect(resolve.home())
}
