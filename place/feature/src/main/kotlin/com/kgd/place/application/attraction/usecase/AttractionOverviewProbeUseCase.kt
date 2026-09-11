package com.kgd.place.application.attraction.usecase

interface AttractionOverviewProbeUseCase {
    /** 원천이 빈 개요를 준 (contentId, lang) 기록 — 다음 수집에서 제외된다. */
    fun record(commands: List<Command>): Int

    /** 제외 목록 (`lang:contentId`). */
    fun findKeys(lang: String?): List<String>

    data class Command(val contentId: String, val lang: String)
}
