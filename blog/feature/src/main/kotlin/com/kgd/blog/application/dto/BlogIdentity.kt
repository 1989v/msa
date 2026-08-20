package com.kgd.blog.application.dto

import com.kgd.blog.domain.model.VoterKey

/**
 * 게이트웨이가 검증해 넘긴 신원.
 *
 * 클라이언트가 보낸 `X-User-Id` 는 신뢰하지 않는다 — 게이트웨이의 인증 필터가 익명 통과 시
 * 이 헤더를 벗겨내고, 인증 통과 시에만 자기가 채운다 (AuthenticationGatewayFilter).
 */
data class BlogIdentity(
    val memberId: Long?,
    val isAdmin: Boolean,
    val visitorId: String?,
) {
    val loggedIn: Boolean get() = memberId != null

    fun voterKey(): VoterKey = VoterKey.of(memberId?.toString(), visitorId)

    companion object {
        fun of(userId: String?, roles: String?, visitorId: String?) = BlogIdentity(
            memberId = userId?.trim()?.takeIf { it.isNotEmpty() }?.toLongOrNull(),
            isAdmin = roles?.split(',')?.any { it.trim() == "ROLE_ADMIN" } ?: false,
            visitorId = visitorId?.trim()?.takeIf { it.isNotEmpty() },
        )
    }
}
