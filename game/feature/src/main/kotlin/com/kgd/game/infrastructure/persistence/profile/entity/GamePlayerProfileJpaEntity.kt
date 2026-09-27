package com.kgd.game.infrastructure.persistence.profile.entity

import com.kgd.game.domain.profile.model.GameNickname
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table

@Entity
@Table(name = "game_player_profile")
class GamePlayerProfileJpaEntity(
    @Id @Column(name = "player_id", length = 36) val playerId: String,
    memberId: Long?,
    guestTokenHash: String?,
    nickname: String,
    nicknameKey: String,
) {
    @Column(name = "member_id", unique = true) var memberId: Long? = memberId
        private set
    @Column(name = "guest_token_hash", length = 64, unique = true) var guestTokenHash: String? = guestTokenHash
        private set
    @Column(nullable = false, length = 32) var nickname: String = nickname
        private set
    @Column(name = "nickname_key", nullable = false, length = 64, unique = true) var nicknameKey: String = nicknameKey
        private set

    fun rename(name: GameNickname) { nickname = name.value; nicknameKey = name.key }
    fun claim(memberId: Long, expectedHash: String) {
        check(this.memberId == null && guestTokenHash == expectedHash)
        this.memberId = memberId
        guestTokenHash = null
    }
}
