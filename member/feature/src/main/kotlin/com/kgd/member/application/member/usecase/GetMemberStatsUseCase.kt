package com.kgd.member.application.member.usecase

/** 어드민 대시보드용 회원 집계 (read-only). */
interface GetMemberStatsUseCase {
    fun execute(): Result

    data class Result(val newCount: Long, val totalCount: Long)
}
