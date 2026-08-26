package com.kgd.member.presentation.member.controller

import com.kgd.common.response.ApiResponse
import com.kgd.member.application.member.usecase.GetMemberStatsUseCase
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/** MemberStatsController — admin dashboard 용 read-only 회원 카운트. */
@RestController
@RequestMapping("/api/members/stats")
class MemberStatsController(
    private val getMemberStats: GetMemberStatsUseCase,
) {
    @GetMapping("/count")
    fun memberCount(): ApiResponse<MemberCountResponse> {
        val stats = getMemberStats.execute()
        return ApiResponse.success(MemberCountResponse(newCount = stats.newCount, totalCount = stats.totalCount))
    }
}

data class MemberCountResponse(val newCount: Long, val totalCount: Long)
