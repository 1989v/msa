package com.kgd.game.application.arcade.usecase

import com.kgd.game.application.arcade.SubmitCommand
import com.kgd.game.application.arcade.SubmitOutcome

/** 점수 제출 — Tier A(경량) → 잠정 등재 → Tier B(상위 N 진입 시 풀 리플레이) */
interface SubmitArcadeScoreUseCase {
    fun execute(command: SubmitCommand): SubmitOutcome
}
