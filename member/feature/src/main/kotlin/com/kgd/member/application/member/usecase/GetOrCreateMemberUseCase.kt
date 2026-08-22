package com.kgd.member.application.member.usecase

import com.kgd.member.domain.model.SsoProvider

interface GetOrCreateMemberUseCase {
    fun execute(command: Command): Result

    /**
     * [ssoProviderId] 는 auth 가 HMAC 을 씌운 값이다 (ADR-0078).
     * 이메일·실명은 받지 않는다 — 조회 키가 아니었고, 표시 이름은 가입 시 생성한다.
     */
    data class Command(
        val ssoProvider: SsoProvider,
        val ssoProviderId: String
    )

    data class Result(
        val id: Long,
        val isNewMember: Boolean
    )
}
