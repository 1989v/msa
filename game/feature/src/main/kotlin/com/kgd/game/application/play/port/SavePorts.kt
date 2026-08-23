package com.kgd.game.application.play.port

import com.kgd.game.domain.play.model.ScoreTrack
import com.kgd.game.domain.play.model.GameRun
import java.time.Duration

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

/**
 * 세이브 디바이스 리스 — 로드 시 획득, TTL 동안 다른 holder 의 로드/저장을 차단
 * (멀티탭/멀티기기 동시 조작 방어. 세이브스커밍 방어는 GameRun 시드가 담당).
 */
interface SaveLeasePort {
    /**
     * subject 는 회원 세이브면 memberId, 게스트 세이브면 이어하기 코드.
     * takeover=true 면 다른 holder 가 점유 중이어도 빼앗는다 — 코드를 아는 것 자체가 자격 증명이므로
     * 기기를 옮긴 사용자가 이전 기기의 리스에 막히지 않게 한다.
     */
    fun tryAcquire(gameId: Long, subject: String, holder: String, ttl: Duration, takeover: Boolean = false): Boolean
}

/** 랭킹 항목 — rank 는 조회 시점 계산 */
data class ScoreEntry(val rank: Int, val nickname: String, val score: Long, val detail: String?)

/** 보드 식별자 — 랭킹은 게임이 아니라 (게임, 트랙) 단위다. 두 트랙은 비교 대상이 아니라 합치지 않는다 */
data class ScoreBoardRef(val gameId: Long, val track: ScoreTrack)

interface GameScoreRepositoryPort {
    /** 트랙 안에서 닉네임당 최고 기록 upsert. 반영 여부와 그 트랙 내 순위를 돌려준다 */
    fun submit(gameId: Long, track: ScoreTrack, nickname: String, score: Long, detail: String?): Pair<Boolean, Int>
    fun top(gameId: Long, track: ScoreTrack, limit: Int): List<ScoreEntry>

    /**
     * 기록이 하나라도 있는 보드를 최근 갱신순으로. 기록 없는 보드는 애초에 행이 없으므로 나오지 않는다 —
     * 허브가 카탈로그 전체(60여 종)에 리더보드를 물어보지 않아도 되는 이유다.
     */
    fun activeBoards(limit: Int): List<ScoreBoardRef>
}
