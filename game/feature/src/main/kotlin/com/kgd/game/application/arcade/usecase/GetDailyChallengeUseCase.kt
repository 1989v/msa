package com.kgd.game.application.arcade.usecase

import com.kgd.game.domain.arcade.DailyChallenge

/** 그날의 공통 seed 챌린지. 없으면 만들어서 돌려준다. */
interface GetDailyChallengeUseCase {
    fun current(gameId: String, date: String): DailyChallenge
}
