package com.kgd.place.domain.attraction.model

import java.time.LocalDateTime

/**
 * 한 관광지의 무장애 여행 정보 — 한국관광공사 `KorWithService2` 의 목록 행과 상세 응답.
 *
 * 원문(목록 행 · 상세 응답)은 통째로 두고, 화면·필터가 쓰는 긍정 코드 목록([flags])만 파생 값이다.
 * 파생은 수집기(place-ingest `barrier_free.py`)가 하고 [flagsRuleVer] 로 그 규칙의 판을 남긴다 —
 * 규칙이 바뀌면 옛 판으로 남은 행을 찾아 원문에서 다시 만든다.
 *
 * [detailSyncedAt] 이 null 이면 아직 상세를 받지 않은 곳이다(백필 대상). 원천이 빈 상세를 줘도 받은 시각은 남는다.
 */
data class AttractionBarrierFree(
    val attractionId: Long,
    val contentId: String,
    val listRaw: String?,
    val listModifiedAt: LocalDateTime?,
    val detailRaw: String?,
    val detailSyncedAt: LocalDateTime?,
    val flags: List<String>,
    val flagsRuleVer: Int?,
) {
    init {
        require(contentId.isNotBlank()) { "contentId 가 비었습니다: $attractionId" }
        require(flags.all { FLAG_PATTERN.matches(it) }) { "플래그는 대문자 코드여야 합니다: $flags" }
        require(flags.toSet().size == flags.size) { "플래그가 겹칩니다: $flags" }
    }

    companion object {
        private val FLAG_PATTERN = Regex("[A-Z][A-Z_]{1,31}")

        /** 저장 컬럼(VARCHAR 255) 표기 — 쉼표로 잇는다. */
        fun joinFlags(flags: List<String>): String? = flags.takeIf { it.isNotEmpty() }?.joinToString(",")

        fun splitFlags(stored: String?): List<String> =
            stored?.split(",")?.map { it.trim() }?.filter { it.isNotEmpty() }.orEmpty()
    }
}

/**
 * 웰니스관광 테마 태그 — 한국관광공사 `WellnessTursmService` 목록 행 하나. 관광지 한 곳에 테마 하나다.
 * 테마 코드(`EX05xxxx`)는 TourAPI 신분류 소분류 코드와 같은 체계라 이름은 분류 코드표가 갖는다.
 */
data class AttractionWellness(
    val attractionId: Long,
    val contentId: String,
    val lang: String,
    val themaCd: String,
    val listRaw: String,
) {
    init {
        require(lang in LANGS) { "언어는 ko·en 이어야 합니다: $lang" }
        require(themaCd.isNotBlank()) { "테마 코드가 비었습니다: $contentId" }
    }

    companion object {
        val LANGS = setOf("ko", "en")
    }
}
