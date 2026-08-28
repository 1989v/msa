package com.kgd.game.application.play.port

import com.kgd.game.domain.play.model.ScoreBoardKey
import com.kgd.game.domain.play.model.ScoreTrack
import com.kgd.game.domain.play.model.GameRun
import java.time.LocalDate

/** 세이브 스냅샷 — data 는 게임이 정의하는 불투명 JSON 문자열, code 는 이어하기 코드 */
data class SaveSnapshot(val data: String, val version: Long, val code: String?)

interface GameSaveRepositoryPort {
    /** 로그인 사용자의 세이브 */
    fun find(gameId: Long, memberId: Long): SaveSnapshot?

    /** 이어하기 코드로 찾는 세이브 — 게스트의 유일한 신원 */
    fun findByCode(gameId: Long, code: String): SaveSnapshot?

    /**
     * 낙관적 업서트 — expectedVersion 이 현재 버전과 다르면 SaveVersionConflictException.
     * 신규 세이브는 expectedVersion=0 으로 생성하며 이어하기 코드를 함께 발급한다.
     * memberId 가 없으면 code 로 대상 행을 찾는다 (code 도 없으면 새 세이브).
     */
    fun upsert(gameId: Long, memberId: Long?, code: String?, data: String, expectedVersion: Long): SaveSnapshot
}

interface GameRunRepositoryPort {
    fun save(run: GameRun): GameRun
    fun findByRunKey(runKey: String): GameRun?
}

/** 랭킹 항목 — rank 는 조회 시점 계산 */
data class ScoreEntry(val rank: Int, val nickname: String, val score: Long, val detail: String?)

/**
 * 보드 식별자 — 랭킹은 게임이 아니라 **(게임, 트랙, 보드)** 단위다.
 * 트랙은 플랫폼이 나눈 축(무강화/강화), 보드는 게임이 나눈 축(모드)이고 셋 다 비교 대상이
 * 아니라 합치지 않는다.
 */
data class ScoreBoardRef(val gameId: Long, val track: ScoreTrack, val board: ScoreBoardKey)

interface GameScoreRepositoryPort {
    /**
     * 보드 안에서 닉네임당 최고 기록 upsert. 반영 여부와 그 보드 내 **역대** 순위를 돌려준다.
     *
     * 같은 호출이 오늘 보드(`playDate` 안에서 닉네임당 최고)도 함께 올린다 — 제출 한 번에
     * 보드 둘이 갱신되어야 두 보드가 어긋나지 않는다. 둘의 판정은 독립이다:
     * 지난달의 자기 최고에 못 미친 런도 오늘 안에서는 최고일 수 있다.
     */
    fun submit(
        gameId: Long,
        track: ScoreTrack,
        board: ScoreBoardKey,
        nickname: String,
        score: Long,
        detail: String?,
        playDate: LocalDate,
    ): Pair<Boolean, Int>

    fun top(gameId: Long, track: ScoreTrack, board: ScoreBoardKey, limit: Int): List<ScoreEntry>

    /** 그 날짜 안에서의 상위 기록. 아무도 안 논 날은 빈 목록이고, 그게 정상이다 */
    fun topDaily(
        gameId: Long,
        track: ScoreTrack,
        board: ScoreBoardKey,
        playDate: LocalDate,
        limit: Int,
    ): List<ScoreEntry>

    /**
     * 기록이 하나라도 있는 보드를 최근 갱신순으로. 기록 없는 보드는 애초에 행이 없으므로 나오지 않는다 —
     * 허브가 카탈로그 전체(60여 종)에 리더보드를 물어보지 않아도 되는 이유다.
     */
    fun activeBoards(limit: Int): List<ScoreBoardRef>
}
