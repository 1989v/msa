package com.kgd.game.application.play.usecase

import com.kgd.game.domain.play.model.ScoreBoardKey
import com.kgd.game.domain.play.model.ScoreTrack

/**
 * 점수 제출 — 역대 보드와 오늘 보드를 한 트랜잭션에서 함께 올린다. 날짜는 서버가 정한다.
 *
 * 운영자(ROLE_ADMIN)와 자동화(헤드리스·크롤러 UA)의 제출은 **기록하지 않는다** — 실제 플레이가 아니라
 * 기록이 아니다. 응답은 성공이되 `excluded=true` 로 그 사실을 밝힌다 (ADR-0084 개정 2026-09-20).
 */
interface SubmitGameScoreUseCase {
    fun execute(command: Command): Result

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
        /** 운영자(ROLE_ADMIN) 제출 — 기록하지 않는다. 맨 뒤 기본값 규칙은 memberId 와 같다 */
        val isOperator: Boolean = false,
        /** 자동화 UA 제출 — 기록하지 않는다 */
        val isAutomation: Boolean = false,
    )

    /**
     * `excluded` = 기록 대상이 아닌 제출. `applied`(자기 최고를 넘겼는가)와 독립인 축이고,
     * `excluded` 일 때만 `rank = 0` 이다 — 기록된 제출의 순위는 항상 1 이상이다.
     */
    data class Result(val applied: Boolean, val rank: Int, val excluded: Boolean = false)
}
