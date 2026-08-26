package com.kgd.blog.application.interaction.usecase

/** 보존기간 초과 조회 원장 정리 — retention CronJob 이 부른다 (ADR-0077) */
interface PurgeBlogViewsUseCase {
    /** @return 지운 행 수 */
    fun execute(): Int

    companion object {
        /** `/privacy` §6 의 숫자와 같아야 한다 — 한쪽만 고치면 개인정보처리방침이 거짓이 된다 */
        const val RETENTION_DAYS = 90L
    }
}
