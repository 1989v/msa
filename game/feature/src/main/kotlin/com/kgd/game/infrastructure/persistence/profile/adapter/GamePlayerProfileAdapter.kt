package com.kgd.game.infrastructure.persistence.profile.adapter

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.game.application.profile.port.GamePlayerOwner
import com.kgd.game.application.profile.port.GamePlayerProfile
import com.kgd.game.application.profile.port.GamePlayerProfilePort
import com.kgd.game.domain.profile.model.GameNickname
import com.kgd.game.infrastructure.persistence.profile.entity.GamePlayerProfileJpaEntity
import com.kgd.game.infrastructure.persistence.profile.repository.GamePlayerProfileJpaRepository
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.stereotype.Repository
import java.util.UUID

@Repository
class GamePlayerProfileAdapter(private val profiles: GamePlayerProfileJpaRepository) : GamePlayerProfilePort {
    override fun find(owner: GamePlayerOwner): GamePlayerProfile? =
        (if (owner.memberId != null) profiles.findByMemberId(owner.memberId)
        else owner.guestTokenHash?.let(profiles::findByGuestTokenHash))?.toProfile()

    override fun findForUpdate(owner: GamePlayerOwner): GamePlayerProfile? = lock(owner)?.toProfile()

    private fun lock(owner: GamePlayerOwner): GamePlayerProfileJpaEntity? =
        if (owner.memberId != null) profiles.lockMember(owner.memberId)
        else owner.guestTokenHash?.let(profiles::lockGuest)
            ?.takeIf { it.memberId == null && it.guestTokenHash == owner.guestTokenHash }

    override fun save(owner: GamePlayerOwner, nickname: GameNickname): GamePlayerProfile {
        var row = lock(owner)
        if (row == null && owner.memberId != null && owner.guestTokenHash != null) {
            row = profiles.lockGuest(owner.guestTokenHash)
                ?.takeIf { it.memberId == null && it.guestTokenHash == owner.guestTokenHash }
            row?.claim(owner.memberId, owner.guestTokenHash)
        }
        if (row == null) row = GamePlayerProfileJpaEntity(
            UUID.randomUUID().toString(), owner.memberId,
            if (owner.memberId == null) owner.guestTokenHash else null, nickname.value, nickname.key,
        ) else row.rename(nickname)
        try {
            return profiles.saveAndFlush(row).toProfile()
        } catch (e: DataIntegrityViolationException) {
            // Constraint failures are flushed inside the transaction, so failed claims roll back too.
            throw BusinessException(ErrorCode.DUPLICATE_RESOURCE, "이미 사용 중인 닉네임이거나 프로필이 변경되었습니다. 다시 시도해 주세요")
        }
    }

    private fun GamePlayerProfileJpaEntity.toProfile() = GamePlayerProfile(playerId, nickname)
}
