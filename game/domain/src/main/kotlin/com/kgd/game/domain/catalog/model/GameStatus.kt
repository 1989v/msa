package com.kgd.game.domain.catalog.model

/**
 * 게임 라이프사이클 (ADR-0059 §1, CrazyGames 2단계 런칭 모델).
 * BETA 는 제한 노출 + 수익화 OFF, PUBLISHED 만 수익화 대상.
 */
enum class GameStatus {
    DRAFT,
    REVIEW,
    BETA,
    PUBLISHED,
    SUSPENDED
}
