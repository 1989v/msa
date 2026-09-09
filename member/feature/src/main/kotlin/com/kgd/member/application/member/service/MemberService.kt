package com.kgd.member.application.member.service

import com.kgd.member.application.member.port.MemberRepositoryPort
import com.kgd.member.application.member.port.RosterPurgePort
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

private val log = io.github.oshai.kotlinlogging.KotlinLogging.logger {}

@Service
class MemberService(
    private val memberRepositoryPort: MemberRepositoryPort,
    private val rosterPurgePort: RosterPurgePort
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
        // 다른 서비스가 들고 있는 회원 데이터도 함께 파기한다 (ADR-0092) —
        // 친구 그룹은 game_db 에 있고 그것은 **제3자의 이름**이라 방침 §6 이 그 행에도 걸린다.
        //
        // **여기서 감싼다.** 어댑터도 삼키지만 그건 그 구현의 규율일 뿐이고, 다른 어댑터를
        // 끼우는 순간 탈퇴가 남의 서비스 가용성에 묶인다. 놓친 행은 보존 배치가 그물로 잡는다.
        runCatching { rosterPurgePort.purgeByMember(command.memberId) }
            .onFailure { log.error(it) { "탈퇴 후 외부 데이터 파기 실패 — member=${command.memberId}" } }
    }
}
