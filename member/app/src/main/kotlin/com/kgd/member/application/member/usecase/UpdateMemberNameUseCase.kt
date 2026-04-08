package com.kgd.member.application.member.usecase

interface UpdateMemberNameUseCase {
    fun execute(command: Command)

    data class Command(val memberId: Long, val name: String)
}
