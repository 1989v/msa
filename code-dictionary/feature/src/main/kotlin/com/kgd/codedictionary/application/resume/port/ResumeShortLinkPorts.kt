package com.kgd.codedictionary.application.resume.port

import java.time.LocalDateTime

/** 단축 주소 클릭 원장(`resume_short_link_click`) + 누적 수(`resume_short_link_stat`). */
interface ResumeShortLinkClickRepositoryPort {

    /** 원장 1행을 남기고 누적 수를 원자적으로 1 올린다. */
    fun record(shareLinkId: Long, clickedAt: LocalDateTime)

    /** 보존기간 초과 원장 정리 (ADR-0077). 누적 수는 지우지 않는다. */
    fun purgeOlderThan(cutoff: LocalDateTime): Int
}
