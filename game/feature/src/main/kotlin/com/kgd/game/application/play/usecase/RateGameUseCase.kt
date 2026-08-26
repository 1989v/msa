package com.kgd.game.application.play.usecase

import com.kgd.game.application.play.dto.RatingResultDto

/** 평점 upsert — 회원은 1인 1표, 비로그인은 기기 1표 */
interface RateGameUseCase {
    fun execute(command: Command): RatingResultDto

    data class Command(val slug: String, val memberId: Long?, val deviceId: String?, val score: Int)
}
