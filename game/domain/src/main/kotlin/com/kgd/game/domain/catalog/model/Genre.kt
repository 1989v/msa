package com.kgd.game.domain.catalog.model

/**
 * 게임 장르 — 게임당 1개의 대표 분류 (리스트 카테고리 내비게이션 축).
 * 다중 성격은 tags 가 담당하고, genre 는 항상 단일이다.
 */
enum class Genre {
    ARCADE,
    ACTION,
    PUZZLE,
    RPG,
    EDUCATION,
    CASUAL;

    companion object {
        fun parse(value: String?): Genre? =
            value?.let { raw -> entries.firstOrNull { it.name.equals(raw, ignoreCase = true) } }
    }
}
