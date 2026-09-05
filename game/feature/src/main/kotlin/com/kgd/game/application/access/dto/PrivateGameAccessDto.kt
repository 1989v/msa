package com.kgd.game.application.access.dto

import com.kgd.game.domain.access.model.PrivateGameAccess
import java.time.LocalDateTime

data class PrivateGameAccessDto(
    val memberId: Long,
    val note: String?,
    val createdAt: LocalDateTime,
) {
    companion object {
        fun from(access: PrivateGameAccess) =
            PrivateGameAccessDto(access.memberId, access.note, access.createdAt)
    }
}
