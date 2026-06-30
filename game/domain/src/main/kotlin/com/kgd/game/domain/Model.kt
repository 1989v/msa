package com.kgd.game.domain

import com.kgd.game.sim.ReplayLog

@JvmInline
value class SessionId(val value: String)

@JvmInline
value class PlayerId(val value: String)

enum class SessionStatus { OPEN, SUBMITTED, EXPIRED }

enum class VerificationStatus { PROVISIONAL, CONFIRMED, REJECTED }

enum class LeaderboardPeriod { DAILY, ALL_TIME }

/** 게스트(미등록) vs 등록 계정. 경쟁 랭킹 등재는 registered=true 만(밴 유효). */
data class Player(
    val id: PlayerId,
    val nickname: String,
    val registered: Boolean,
)

/** 데일리 챌린지 — gameId+date 당 공통 seed(모두 같은 맵 → 절차적 맵 공정 경쟁). */
data class DailyChallenge(
    val gameId: String,
    val date: String, // ISO yyyy-MM-dd (UTC)
    val seed: Int,
)

/** 한 판의 플레이 세션. player-set size=1 (MVP — 후일 match=size N 으로 확장). */
data class GameSession(
    val id: SessionId,
    val gameId: String,
    val playerId: PlayerId?, // 시작 시점엔 게스트(null) 가능
    val seed: Int,
    val dailyDate: String?,  // 데일리 챌린지 날짜(공통 seed), 자유 플레이면 null
    val startedEpochMs: Long,
    val status: SessionStatus,
) {
    fun elapsedMs(nowEpochMs: Long): Long = (nowEpochMs - startedEpochMs).coerceAtLeast(0)
}

/** 클라가 제출하는 결과 — claimedScore 는 신뢰 대상이 아니며 Tier A/B 가 검증한다. */
data class ScoreSubmission(
    val sessionId: SessionId,
    val claimedScore: Int,
    val replay: ReplayLog,
    val clientDurationMs: Long,
    val nickname: String,
)

/** Tier B 재실행을 위해 보관하는 리플레이. */
data class StoredReplay(
    val sessionId: SessionId,
    val replay: ReplayLog,
    val claimedScore: Int,
    val status: VerificationStatus,
)

/** 리더보드 보드 식별자. dateKey = DAILY 면 날짜, ALL_TIME 이면 null. */
data class BoardKey(
    val gameId: String,
    val period: LeaderboardPeriod,
    val dateKey: String?,
)

data class LeaderboardEntry(
    val rank: Int,
    val playerId: PlayerId,
    val nickname: String,
    val score: Int,
    val status: VerificationStatus,
)

data class GameCatalogItem(val gameId: String, val title: String)
