package com.kgd.member.application.member.service

import com.kgd.member.application.member.port.MemberRepositoryPort
import com.kgd.member.application.member.usecase.GetMemberProfileUseCase
import com.kgd.member.application.member.usecase.GetMemberStatsUseCase
import com.kgd.member.application.member.usecase.GetOrCreateMemberUseCase
import com.kgd.member.application.member.usecase.UpdateMemberNameUseCase
import com.kgd.member.application.member.usecase.WithdrawMemberUseCase
import com.kgd.member.domain.exception.MemberNotFoundException
import com.kgd.member.domain.model.Member
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate

@Service
class MemberService(
    private val memberRepositoryPort: MemberRepositoryPort
) : GetOrCreateMemberUseCase,
    GetMemberProfileUseCase,
    GetMemberStatsUseCase,
    UpdateMemberNameUseCase,
    WithdrawMemberUseCase {

    @Transactional("memberTransactionManager")
    override fun execute(command: GetOrCreateMemberUseCase.Command): GetOrCreateMemberUseCase.Result {
        val existing = memberRepositoryPort.findBySsoProviderAndSsoProviderId(
            command.ssoProvider, command.ssoProviderId
        )

        if (existing != null) {
            return GetOrCreateMemberUseCase.Result(
                id = requireNotNull(existing.id),
                isNewMember = false
            )
        }

        // 표시 이름은 Member.create 가 만든다 — 제공자에게서 받는 것이 식별값뿐이라서다
        val newMember = Member.create(
            ssoProvider = command.ssoProvider,
            ssoProviderId = command.ssoProviderId
        )
        val saved = memberRepositoryPort.save(newMember)

        return GetOrCreateMemberUseCase.Result(
            id = requireNotNull(saved.id),
            isNewMember = true
        )
    }

    @Transactional("memberTransactionManager", readOnly = true)
    override fun execute(query: GetMemberProfileUseCase.Query): GetMemberProfileUseCase.Result {
        val member = memberRepositoryPort.findById(query.memberId)
            ?: throw MemberNotFoundException()

        return GetMemberProfileUseCase.Result(
            id = requireNotNull(member.id),
            name = member.name,
            ssoProvider = member.ssoProvider.name,
            status = member.status
        )
    }

    @Transactional("memberTransactionManager", readOnly = true)
    override fun execute(): GetMemberStatsUseCase.Result = GetMemberStatsUseCase.Result(
        newCount = memberRepositoryPort.countJoinedAfter(LocalDate.now().atStartOfDay()),
        totalCount = memberRepositoryPort.countAll(),
    )

    @Transactional("memberTransactionManager")
    override fun execute(command: UpdateMemberNameUseCase.Command) {
        val member = memberRepositoryPort.findById(command.memberId)
            ?: throw MemberNotFoundException()
        member.updateName(command.name)
        memberRepositoryPort.save(member)
    }

    @Transactional("memberTransactionManager")
    override fun execute(command: WithdrawMemberUseCase.Command) {
        val member = memberRepositoryPort.findById(command.memberId)
            ?: throw MemberNotFoundException()
        member.withdraw()
        memberRepositoryPort.save(member)
    }
}
