package com.kgd.place.application.shortlink.usecase

/** 보존기간 초과 단축 주소 클릭 원장 정리 — retention CronJob 이 부른다 (ADR-0077). 누적 수는 지우지 않는다. */
interface PurgeAttractionShortLinkClicksUseCase {
    /** @return 지운 행 수 */
    fun olderThan(days: Long): Int
}
