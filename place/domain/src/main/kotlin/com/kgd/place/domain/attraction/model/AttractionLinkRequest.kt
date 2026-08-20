package com.kgd.place.domain.attraction.model

import java.time.LocalDateTime

/**
 * 수집 상태 겸 우선순위 큐 (ADR-0070 §3~4).
 *
 * **행을 지우지 않는다.** [nextAttemptAt] 하나가 신선도와 재시도를 함께 표현하고,
 * [lastAttemptAt] 이 그날 쓴 API 호출 수를 세는 근거가 된다. 성공한 행을 지우면 그날 몇 번
 * 불렀는지 알 수 없어져 일일 예산(YouTube search.list 는 하루 100건)을 지킬 수 없다.
 *
 * 실패를 영구 제외로 바꾸지 않는다 — 429 는 한도이지 그 레코드의 결함이 아니다.
 * 개요 수집에서 같은 실수(일시 실패를 negative cache 에 기록)로 재시도가 영영 막힌 적이 있다.
 */
class AttractionLinkRequest private constructor(
    val id: Long? = null,
    val attractionId: Long,
    val source: AttractionLinkSource,
    var viewCount: Int,
    val requestedAt: LocalDateTime,
    var lastAttemptAt: LocalDateTime? = null,
    var nextAttemptAt: LocalDateTime? = null,
) {
    companion object {
        /**
         * 수집 성공분의 기본 유효 기간 — 지나면 다시 훑는다.
         *
         * 소스가 더 짧은 주기를 요구하면 [markCollected] 인자로 넘긴다. YouTube 는 API 서비스
         * 약관이 **30일 넘게 보관하려면 갱신**하도록 요구해 90일을 그대로 쓸 수 없다.
         */
        const val FRESH_DAYS = 90L

        /** 원천이 결과를 0건으로 준 경우. 영영 제외하지 않는다 — 새 영상이 올라올 수 있다. */
        const val EMPTY_RETRY_DAYS = 30L

        /** 429·네트워크 실패. 다음 날 예산으로 넘긴다. */
        const val FAILURE_RETRY_DAYS = 1L

        fun create(
            attractionId: Long,
            source: AttractionLinkSource,
            requestedAt: LocalDateTime = LocalDateTime.now(),
        ) = AttractionLinkRequest(
            attractionId = attractionId,
            source = source,
            viewCount = 1,
            requestedAt = requestedAt,
        )

        fun restore(
            id: Long?,
            attractionId: Long,
            source: AttractionLinkSource,
            viewCount: Int,
            requestedAt: LocalDateTime,
            lastAttemptAt: LocalDateTime?,
            nextAttemptAt: LocalDateTime?,
        ) = AttractionLinkRequest(
            id, attractionId, source, viewCount, requestedAt, lastAttemptAt, nextAttemptAt,
        )
    }

    /** 조회될 때마다 올린다 — 실제로 열어본 곳부터 한정된 예산을 쓴다. */
    fun markViewed() {
        viewCount += 1
    }

    fun markCollected(at: LocalDateTime = LocalDateTime.now(), freshDays: Long = FRESH_DAYS) =
        markAttempt(at, freshDays)

    fun markEmpty(at: LocalDateTime = LocalDateTime.now()) = markAttempt(at, EMPTY_RETRY_DAYS)

    fun markFailed(at: LocalDateTime = LocalDateTime.now()) = markAttempt(at, FAILURE_RETRY_DAYS)

    /** 지금 수집 대상인가 — 한 번도 안 했거나 유효 기간이 지났으면. */
    fun isDue(now: LocalDateTime = LocalDateTime.now()): Boolean =
        nextAttemptAt?.isAfter(now) != true

    private fun markAttempt(at: LocalDateTime, retryAfterDays: Long) {
        lastAttemptAt = at
        nextAttemptAt = at.plusDays(retryAfterDays)
    }
}
