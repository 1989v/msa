package com.kgd.game.application.play.usecase

import com.kgd.game.application.play.port.ScoreEntry
import com.kgd.game.domain.play.model.ScoreBoardKey
import com.kgd.game.domain.play.model.ScorePeriod
import com.kgd.game.domain.play.model.ScoreTrack
import java.time.LocalDate

/** `period` 생략 = 역대 보드(기존 위젯 계약). `date` 는 DAILY 에서만, 생략하면 KST 오늘 */
interface GetGameLeaderboardUseCase {
    fun execute(query: Query): List<ScoreEntry>

    data class Query(
        val slug: String,
        val track: ScoreTrack,
        val limit: Int,
        val board: ScoreBoardKey = ScoreBoardKey.DEFAULT,
        val period: ScorePeriod = ScorePeriod.ALL_TIME,
        val date: LocalDate? = null,
    )
}
