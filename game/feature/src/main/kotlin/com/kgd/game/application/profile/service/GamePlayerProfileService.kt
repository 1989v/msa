package com.kgd.game.application.profile.service

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.game.application.profile.port.GamePlayerOwner
import com.kgd.game.application.profile.port.GamePlayerProfile
import com.kgd.game.application.profile.port.GamePlayerProfilePort
import com.kgd.game.application.profile.usecase.GamePlayerProfileUseCase
import com.kgd.game.domain.profile.model.GameNickname
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.annotation.Isolation

@Service
class GamePlayerProfileService(private val profiles: GamePlayerProfilePort) : GamePlayerProfileUseCase {
    // Ownership reads use master as well: a just-saved profile must be immediately visible.
    @Transactional(transactionManager = "gameTransactionManager")
    override fun get(owner: GamePlayerOwner): GamePlayerProfile? = profiles.find(owner)

    // Unique keys arbitrate new owners; READ_COMMITTED avoids locking absent-owner index gaps.
    @Transactional(transactionManager = "gameTransactionManager", isolation = Isolation.READ_COMMITTED)
    override fun save(owner: GamePlayerOwner, nickname: String): GamePlayerProfile {
        if (owner.memberId == null && owner.guestTokenHash == null) {
            throw BusinessException(ErrorCode.UNAUTHORIZED)
        }
        val normalized = try { GameNickname.from(nickname) } catch (e: IllegalArgumentException) {
            throw BusinessException(ErrorCode.INVALID_INPUT, e.message ?: "닉네임 형식 오류")
        }
        return profiles.save(owner, normalized)
    }
}
