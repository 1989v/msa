package com.kgd.game.application.ads.usecase

import com.kgd.game.application.ads.dto.RewardDto

/** 시청 완료 콜백 — idempotencyKey 기준 멱등 */
interface CompleteAdRewardUseCase {
    fun execute(command: Command): RewardDto

    data class Command(val rewardKey: String)
}
