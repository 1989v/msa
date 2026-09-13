package com.kgd.game.application.roster.service

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.game.application.roster.port.FriendGroupRepositoryPort
import com.kgd.game.application.roster.port.RosterOptInPort
import com.kgd.game.application.roster.usecase.DeleteFriendGroupUseCase
import com.kgd.game.application.roster.usecase.ListFriendGroupsUseCase
import com.kgd.game.application.roster.usecase.PurgeRostersUseCase
import com.kgd.game.application.roster.usecase.SaveFriendGroupUseCase
import com.kgd.game.application.roster.usecase.SetRosterOptInUseCase
import com.kgd.game.domain.roster.model.FriendGroup
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

private val log = KotlinLogging.logger {}

/**
 * 친구 그룹 (ADR-0092).
 *
 * **로그에 별칭도 그룹 이름도 남기지 않는다** — 실명이 들어올 수 있는 자유 텍스트라,
 * 관측을 위해 찍는 순간 그것이 원장이 된다. 수와 회원 id 만 남긴다.
 */
@Service
@Transactional
@Qualifier("gameTransactionManager")
class RosterService(
    private val groups: FriendGroupRepositoryPort,
    private val optIn: RosterOptInPort,
) : ListFriendGroupsUseCase,
    SaveFriendGroupUseCase,
    DeleteFriendGroupUseCase,
    SetRosterOptInUseCase,
    PurgeRostersUseCase {

    @Transactional(readOnly = true)
    override fun execute(query: ListFriendGroupsUseCase.Query): ListFriendGroupsUseCase.Result {
        val memberId = query.memberId
        if (!optIn.isEnabled(memberId)) return ListFriendGroupsUseCase.Result(false, emptyList())
        return ListFriendGroupsUseCase.Result(true, groups.findAllByMember(memberId))
    }

    /**
     * 옵트인이 꺼져 있으면 **저장 자체를 거부한다.** 「켜지 않았는데 올라간다」가 이 기능에서
     * 가장 나쁜 실패다 — 동의 없이 남의 이름을 서버에 두게 된다.
     */
    override fun execute(command: SaveFriendGroupUseCase.Command): FriendGroup {
        if (!optIn.isEnabled(command.memberId)) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "계정 저장이 꺼져 있습니다")
        }
        val existing = command.id?.let { groups.findById(it)?.takeIf { g -> g.memberId == command.memberId } }
        val byName = groups.findByMemberAndName(command.memberId, command.name)

        // 이름이 그룹의 사용자 쪽 식별자다. 다른 행이 그 이름을 쓰고 있으면 덮지 않고 알린다.
        if (byName != null && byName.id != existing?.id && !command.overwrite) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "같은 이름의 그룹이 이미 있습니다")
        }
        val target = existing ?: byName
        val group = FriendGroup(
            id = target?.id,
            memberId = command.memberId,
            name = command.name,
            aliases = command.aliases,
            lastUsedAt = LocalDateTime.now(),
        )
        return groups.save(group)
    }

    override fun execute(command: DeleteFriendGroupUseCase.Command) {
        val group = groups.findById(command.groupId) ?: return
        if (group.memberId != command.memberId) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "내 그룹이 아닙니다")
        }
        groups.delete(command.groupId)
    }

    override fun execute(command: SetRosterOptInUseCase.Command): SetRosterOptInUseCase.Result {
        val memberId = command.memberId
        if (command.enabled) {
            optIn.enable(memberId)
            // **자동 업로드하지 않는다.** 기기에 있던 그룹을 올릴지는 화면이 따로 물어보고,
            // 사용자가 그러겠다고 한 뒤에야 저장 API 가 불린다. 동의 없는 전송이 되면 안 된다.
            return SetRosterOptInUseCase.Result(true, emptyList())
        }
        // 끄기 전에 서버본을 돌려준다 — 켜져 있는 동안 서버가 SSOT 였으므로,
        // 그냥 지우면 최신본이 사라지고 기기의 낡은 사본만 남는다.
        val exported = groups.findAllByMember(memberId)
        val removed = groups.deleteAllByMember(memberId)
        optIn.disable(memberId)
        log.info { "친구 그룹 계정 저장 해제 — member=$memberId, 그룹 ${removed}개 파기" }
        return SetRosterOptInUseCase.Result(false, exported)
    }

    /** 탈퇴 — 방침 §6 「탈퇴 시 지체 없이 파기」. 옵트인 행도 함께 지운다 */
    override fun byMember(memberId: Long): Int {
        val removed = groups.deleteAllByMember(memberId)
        optIn.disable(memberId)
        log.info { "회원 탈퇴로 친구 그룹 파기 — member=$memberId, 그룹 ${removed}개" }
        return removed
    }

    /** 보존기간 정리 — 즉시 파기가 실패했을 때를 받치는 그물이기도 하다 */
    override fun unusedFor(days: Long): Int =
        groups.purgeUnusedBefore(LocalDateTime.now().minusDays(days))
}
