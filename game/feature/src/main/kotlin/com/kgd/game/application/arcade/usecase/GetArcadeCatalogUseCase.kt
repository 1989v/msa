package com.kgd.game.application.arcade.usecase

import com.kgd.game.domain.arcade.GameCatalogItem

/** 아케이드 카탈로그 — 결정적 게임 모듈이 등록된 목록. */
interface GetArcadeCatalogUseCase {
    fun catalog(): List<GameCatalogItem>

    /** 등록되지 않은 gameId 는 세션을 열 수 없다. */
    fun isRegistered(gameId: String): Boolean
}
