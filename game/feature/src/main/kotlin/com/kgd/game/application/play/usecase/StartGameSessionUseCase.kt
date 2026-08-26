package com.kgd.game.application.play.usecase

import com.kgd.game.application.play.dto.SessionStartedDto
import com.kgd.game.domain.play.model.DeviceType

/** 세션 시작 — 게스트 허용 (memberId null) */
interface StartGameSessionUseCase {
    fun execute(command: Command): SessionStartedDto

    data class Command(val slug: String, val memberId: Long?, val deviceType: DeviceType)
}
