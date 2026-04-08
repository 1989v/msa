package com.kgd.member.application.member.usecase

import com.kgd.member.domain.model.SsoProvider

interface GetOrCreateMemberUseCase {
    fun execute(command: Command): Result

    data class Command(
        val email: String,
        val name: String,
        val ssoProvider: SsoProvider,
        val ssoProviderId: String
    )

    data class Result(
        val id: Long,
        val email: String,
        val name: String,
        val isNewMember: Boolean
    )
}
