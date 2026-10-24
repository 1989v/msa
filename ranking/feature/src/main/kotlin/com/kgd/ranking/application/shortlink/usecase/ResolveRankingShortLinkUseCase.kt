package com.kgd.ranking.application.shortlink.usecase

/** 랭킹 단축 주소 `/rk/{별칭}` 의 302 목적지. 응답은 컨트롤러가 만든다. */
interface ResolveRankingShortLinkUseCase {

    fun cafe(): String

    /** `/rk`·모르는 별칭 — 받은 사람이 빈 화면을 보지 않게 랭킹 홈으로 보낸다. */
    fun home(): String
}
