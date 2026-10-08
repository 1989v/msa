package com.kgd.place.application.shortlink.port

import java.time.LocalDateTime

/** 원장 한 행. 리퍼러는 호스트만, UA 는 계열만 — IP 는 받는 자리가 없다. */
data class AttractionShortLinkClick(
    val attractionId: Long,
    val clickedAt: LocalDateTime,
    val referrerHost: String?,
    val uaFamily: String,
)

/** 단축 주소 클릭 원장(`attraction_short_link_click`) + 누적 수(`attraction_short_link_stat`). */
interface AttractionShortLinkClickRepositoryPort {

    /** 원장 1행을 남기고 누적 수를 원자적으로 1 올린다. */
    fun record(click: AttractionShortLinkClick)

    /** 보존기간 초과 원장 정리. 누적 수는 지우지 않는다. */
    fun purgeOlderThan(cutoff: LocalDateTime): Int
}
