package com.kgd.game.application.catalog.service

enum class GameSort {
    TRENDING,
    NEW,
    TOP;

    companion object {
        fun parse(value: String?): GameSort = when (value?.lowercase()) {
            "new" -> NEW
            "top" -> TOP
            else -> TRENDING
        }
    }
}
