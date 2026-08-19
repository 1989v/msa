package com.kgd.place.domain.attraction.model

import java.time.LocalDateTime

/**
 * 개요 수집 negative cache (ADR-0070) — 원천이 개요를 빈 값으로 주는 (contentId, lang) 기록.
 *
 * `Attraction` 의 필드가 아닌 이유: 원천이 다르고 갱신 주체가 다르다. 목록 재동기화가
 * 전체 동기화(`Attraction.syncFrom`)라 같은 행에 두면 보존 예외를 하나 더 만들어야 한다.
 *
 * **일시적 실패(429·네트워크)는 여기 담지 않는다** — 담으면 그 레코드가 영영 재시도되지 않는다.
 */
class AttractionOverviewProbe private constructor(
    val id: Long? = null,
    val contentId: String,
    val lang: String,
    var checkedAt: LocalDateTime,
) {
    companion object {
        fun create(
            contentId: String,
            lang: String,
            checkedAt: LocalDateTime = LocalDateTime.now(),
        ): AttractionOverviewProbe {
            require(contentId.isNotBlank()) { "contentId 는 비어있을 수 없습니다" }
            require(lang in Attraction.SUPPORTED_LANGS) {
                "지원하지 않는 언어입니다: $lang (지원: ${Attraction.SUPPORTED_LANGS})"
            }
            return AttractionOverviewProbe(contentId = contentId, lang = lang, checkedAt = checkedAt)
        }

        fun restore(
            id: Long?,
            contentId: String,
            lang: String,
            checkedAt: LocalDateTime,
        ): AttractionOverviewProbe = AttractionOverviewProbe(id, contentId, lang, checkedAt)
    }

    /** 수집기가 제외 여부를 판정할 때 쓰는 키 — `lang:contentId`. */
    val key: String get() = "$lang:$contentId"

    /** 재확인 시각 갱신 — 자연키는 불변 (entity-mutation.md). */
    fun markCheckedAt(at: LocalDateTime) {
        checkedAt = at
    }
}
