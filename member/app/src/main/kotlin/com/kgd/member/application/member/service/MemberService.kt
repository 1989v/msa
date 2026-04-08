package com.kgd.member.application.member.service

import com.kgd.member.application.member.port.MemberRepositoryPort
import com.kgd.member.application.member.usecase.GetMemberProfileUseCase
import com.kgd.member.application.member.usecase.GetOrCreateMemberUseCase
import com.kgd.member.application.member.usecase.UpdateMemberNameUseCase
import com.kgd.member.application.member.usecase.WithdrawMemberUseCase
import com.kgd.member.domain.exception.MemberNotFoundException
import com.kgd.member.domain.model.Member
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class MemberService(
    private val memberRepositoryPort: MemberRepositoryPort
) : GetOrCreateMemberUseCase, GetMemberProfileUseCase, UpdateMemberNameUseCase, WithdrawMemberUseCase {

    @Transactional
    override fun execute(command: GetOrCreateMemberUseCase.Command): GetOrCreateMemberUseCase.Result {
        val existing = memberRepositoryPort.findBySsoProviderAndSsoProviderId(
            command.ssoProvider, command.ssoProviderId
        )

        if (existing != null) {
            return GetOrCreateMemberUseCase.Result(
                id = requireNotNull(existing.id),
                email = existing.email,
                name = existing.name,
                isNewMember = false
            )
        }

        val newMember = Member.create(
            email = command.email,
            name = command.name,
            ssoProvider = command.ssoProvider,
            ssoProviderId = command.ssoProviderId
        )
        val saved = memberRepositoryPort.save(newMember)

        return GetOrCreateMemberUseCase.Result(
            id = requireNotNull(saved.id),
            email = saved.email,
            name = saved.name,
            isNewMember = true
        )
    }

    @Transactional(readOnly = true)
    override fun execute(query: GetMemberProfileUseCase.Query): GetMemberProfileUseCase.Result {
        val member = memberRepositoryPort.findById(query.memberId)
            ?: throw MemberNotFoundException()

        return GetMemberProfileUseCase.Result(
            id = requireNotNull(member.id),
            email = member.email,
            name = member.name,
            ssoProvider = member.ssoProvider.name,
            status = member.status
        )
    }

    @Transactional
    override fun execute(command: UpdateMemberNameUseCase.Command) {
        val member = memberRepositoryPort.findById(command.memberId)
            ?: throw MemberNotFoundException()
        member.updateName(command.name)
        memberRepositoryPort.save(member)
    }

    @Transactional
    override fun execute(command: WithdrawMemberUseCase.Command) {
        val member = memberRepositoryPort.findById(command.memberId)
            ?: throw MemberNotFoundException()
        member.withdraw()
        memberRepositoryPort.save(member)
    }
}
