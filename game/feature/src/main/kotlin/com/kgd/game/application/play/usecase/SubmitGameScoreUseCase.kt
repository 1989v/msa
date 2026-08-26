package com.kgd.game.application.play.usecase

import com.kgd.game.domain.play.model.ScoreBoardKey
import com.kgd.game.domain.play.model.ScoreTrack

/** 점수 제출 — 역대 보드와 오늘 보드를 한 트랜잭션에서 함께 올린다. 날짜는 서버가 정한다 */
interface SubmitGameScoreUseCase {
    /** @return (applied, rank) */
    fun execute(command: Command): Pair<Boolean, Int>

    data class Command(
        val slug: String,
        val track: ScoreTrack,
        val board: ScoreBoardKey,
        val nickname: String,
        val score: Long,
        val detail: String?,
    )
}
