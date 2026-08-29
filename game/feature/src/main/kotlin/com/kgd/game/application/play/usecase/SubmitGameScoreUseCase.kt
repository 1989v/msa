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
        /**
         * 로그인 상태면 그 회원. 게스트 제출은 계속 허용한다.
         *
         * **맨 뒤에 기본값으로 둔다** — 중간에 끼우면 기존 위치 인자가 조용히 밀리고,
         * score(Long) 가 memberId(Long?) 자리에 들어가도 타입이 맞아 컴파일된다.
         */
        val memberId: Long? = null,
    )
}
