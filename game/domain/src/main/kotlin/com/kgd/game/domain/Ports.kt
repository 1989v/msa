package com.kgd.game.domain

import com.kgd.game.sim.GameModule

/** 시스템 시계 — 도메인이 시스템 의존 없이 시간 정합을 검증하도록 주입. */
interface Clock {
    fun nowEpochMs(): Long
}

/** 서버 발급 seed — 클라가 유리한 seed 를 고르지 못하게(seed shopping 방지). */
interface SeedSource {
    fun newSeed(): Int
}

/** 세션 서명 토큰(HMAC) 발급/검증 — 무플레이/위조 제출 차단. */
interface SessionTokenService {
    fun issue(sessionId: SessionId, seed: Int, startedEpochMs: Long): String
    fun verify(token: String, sessionId: SessionId, seed: Int, startedEpochMs: Long): Boolean
}

interface SessionStore {
    fun save(session: GameSession)
    fun find(id: SessionId): GameSession?
}

interface ReplayStore {
    fun save(stored: StoredReplay)
    fun updateStatus(sessionId: SessionId, status: VerificationStatus)
}

interface LeaderboardPort {
    fun submit(board: BoardKey, playerId: PlayerId, nickname: String, score: Int, status: VerificationStatus)
    fun top(board: BoardKey, limit: Int): List<LeaderboardEntry>
    /** 1-based 순위. 없으면 null. */
    fun rankOf(board: BoardKey, playerId: PlayerId): Int?
    fun setStatus(board: BoardKey, playerId: PlayerId, status: VerificationStatus)
}

interface PlayerStore {
    fun createGuest(nickname: String): Player
    /** MVP 가입-라이트: 닉네임 클레임 → 등록 계정 get-or-create. */
    fun registerOrGet(nickname: String): Player
    fun find(id: PlayerId): Player?
}

interface DailyChallengePort {
    /** gameId+date 의 공통 seed 챌린지를 get-or-create. */
    fun current(gameId: String, date: String): DailyChallenge
}

/** gameId → 결정적 게임 모듈/카탈로그. Tier B 리플레이가 gameId 로 모듈을 찾는다. */
interface GameRegistry {
    fun module(gameId: String): GameModule<*>?
    fun catalog(): List<GameCatalogItem>
}
