package com.kgd.member.application.member.usecase

import com.kgd.member.domain.model.MemberStatus

interface GetMemberProfileUseCase {
    fun execute(query: Query): Result

    data class Query(val memberId: Long)

    data class Result(
        val id: Long,
        val email: String,
        val name: String,
        val ssoProvider: String,
        val status: MemberStatus
    )
}
