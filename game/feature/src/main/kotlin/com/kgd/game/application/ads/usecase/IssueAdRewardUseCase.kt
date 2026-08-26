package com.kgd.game.application.ads.usecase

import com.kgd.game.application.ads.dto.RewardDto

/** rewarded 보상 발급 — PUBLISHED+SDK 게임만 */
interface IssueAdRewardUseCase {
    fun execute(command: Command): RewardDto

    data class Command(val gameSlug: String, val placementKey: String, val sessionKey: String?, val memberId: Long?)
}
