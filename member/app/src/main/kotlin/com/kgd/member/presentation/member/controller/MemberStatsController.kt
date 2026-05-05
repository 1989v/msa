package com.kgd.member.presentation.member.controller

import com.kgd.common.response.ApiResponse
import com.kgd.member.infrastructure.persistence.repository.MemberJpaRepository
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDate

/**
 * MemberStatsController — admin dashboard 용 read-only 회원 카운트.
 *
 * OrderStatsController 와 동일 패턴 — 단순 집계라 port/adapter 추상화 생략.
 */
@RestController
@RequestMapping("/api/members/stats")
class MemberStatsController(
    private val memberJpaRepository: MemberJpaRepository,
) {
    @GetMapping("/count")
    fun memberCount(): ApiResponse<MemberCountResponse> {
        val today = LocalDate.now().atStartOfDay()
        val total = memberJpaRepository.count()
        val newToday = memberJpaRepository.countByCreatedAtAfter(today)
        return ApiResponse.success(MemberCountResponse(newCount = newToday, totalCount = total))
    }
}

data class MemberCountResponse(val newCount: Long, val totalCount: Long)
