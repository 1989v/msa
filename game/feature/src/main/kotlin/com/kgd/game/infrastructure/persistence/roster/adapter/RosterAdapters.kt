package com.kgd.game.infrastructure.persistence.roster.adapter

import com.kgd.game.application.roster.port.FriendGroupRepositoryPort
import com.kgd.game.application.roster.port.RosterOptInPort
import com.kgd.game.domain.roster.model.FriendGroup
import com.kgd.game.infrastructure.persistence.roster.entity.FriendGroupJpaEntity
import com.kgd.game.infrastructure.persistence.roster.entity.RosterOptInJpaEntity
import com.kgd.game.infrastructure.persistence.roster.repository.FriendGroupJpaRepository
import com.kgd.game.infrastructure.persistence.roster.repository.RosterOptInJpaRepository
import org.springframework.stereotype.Component
import java.time.LocalDateTime

@Component
class RosterOptInAdapter(
    private val repository: RosterOptInJpaRepository,
) : RosterOptInPort {

    override fun isEnabled(memberId: Long): Boolean = repository.existsById(memberId)

    override fun enable(memberId: Long) {
        if (!repository.existsById(memberId)) repository.save(RosterOptInJpaEntity(memberId))
    }

    /** **하드 삭제다.** 소프트 삭제로 두면 「껐는데 데이터는 남은」 상태가 되어 방침이 거짓이 된다 */
    override fun disable(memberId: Long) = repository.deleteById(memberId)
}

@Component
class FriendGroupRepositoryAdapter(
    private val repository: FriendGroupJpaRepository,
) : FriendGroupRepositoryPort {

    /**
     * 기존 행이면 **불러온 행에 옮겨 담는다.** 도메인 객체를 그대로 엔티티로 바꿔 저장하면
     * `created_at` 이 지금으로 덮여 「언제 만든 그룹인가」가 사라진다.
     */
    override fun save(group: FriendGroup): FriendGroup {
        val id = group.id ?: return repository.save(FriendGroupJpaEntity.from(group)).toDomain()
        val entity = repository.findById(id).orElse(null)
            ?: return repository.save(FriendGroupJpaEntity.from(group)).toDomain()
        entity.sync(group)
        return repository.save(entity).toDomain()
    }

    override fun findAllByMember(memberId: Long): List<FriendGroup> =
        repository.findAllByMemberIdOrderByLastUsedAtDesc(memberId).map { it.toDomain() }

    override fun findById(id: Long): FriendGroup? = repository.findById(id).orElse(null)?.toDomain()

    override fun findByMemberAndName(memberId: Long, name: String): FriendGroup? =
        repository.findByMemberIdAndName(memberId, name)?.toDomain()

    override fun delete(id: Long) = repository.deleteById(id)

    override fun deleteAllByMember(memberId: Long): Int = repository.deleteByMemberId(memberId)

    override fun purgeUnusedBefore(threshold: LocalDateTime): Int {
        val stale = repository.findAllByLastUsedAtBefore(threshold)
        repository.deleteAll(stale)
        return stale.size
    }
}
