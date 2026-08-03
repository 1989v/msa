package com.kgd.member.application.member.usecase

interface WithdrawMemberUseCase {
    fun execute(command: Command)

    data class Command(val memberId: Long)
}
