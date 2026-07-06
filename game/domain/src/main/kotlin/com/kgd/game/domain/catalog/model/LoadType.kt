package com.kgd.game.domain.catalog.model

/**
 * 게임 로드 방식 — IFRAME: entryUrl 을 iframe 임베드, INTERNAL_ROUTE: portal-fe 내장 라우트.
 */
enum class LoadType {
    IFRAME,
    INTERNAL_ROUTE
}
