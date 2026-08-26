package com.kgd.game.application.catalog.dto

enum class GameSort {
    TRENDING,
    NEW,
    TOP,
    CREATED,
    UPDATED,
    TITLE,
    PLAY_COUNT;

    companion object {
        fun parse(value: String?): GameSort = when (value?.lowercase()) {
            "new" -> NEW
            "top" -> TOP
            else -> TRENDING
        }

        /** 어드민 목록 정렬. 기본은 최근 수정 순 — 방금 편집한 게임을 맨 위에서 다시 찾게 된다. */
        fun parseAdmin(value: String?): GameSort = when (value?.lowercase()) {
            "created" -> CREATED
            "title" -> TITLE
            "playcount" -> PLAY_COUNT
            else -> UPDATED
        }
    }
}
