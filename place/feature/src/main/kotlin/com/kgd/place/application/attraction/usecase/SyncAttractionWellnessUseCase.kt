package com.kgd.place.application.attraction.usecase

/** 웰니스 테마 태그 적재 — 언어 하나의 목록을 통째로 바꾼다(원천에서 빠진 곳은 태그도 빠진다). */
interface SyncAttractionWellnessUseCase {
    fun replace(lang: String, items: List<Item>): Applied

    data class Item(val contentId: String, val themaCd: String, val listRaw: String)

    /** [removed] 는 이번 목록에 없어 태그가 빠진 관광지 수. */
    data class Applied(val matched: Int, val unmatched: Int, val removed: Int)
}
