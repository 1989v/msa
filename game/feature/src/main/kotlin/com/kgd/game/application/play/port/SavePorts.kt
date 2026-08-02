package com.kgd.game.application.play.port

import com.kgd.game.domain.play.model.GameRun
import java.time.Duration

/** 세이브 스냅샷 — data 는 게임이 정의하는 불투명 JSON 문자열 */
data class SaveSnapshot(val data: String, val version: Long)

interface GameSaveRepositoryPort {
    fun find(gameId: Long, memberId: Long): SaveSnapshot?

    /**
     * 낙관적 업서트 — expectedVersion 이 현재 버전과 다르면 SaveVersionConflictException.
     * 신규 세이브는 expectedVersion=0 으로 생성.
     */
    fun upsert(gameId: Long, memberId: Long, data: String, expectedVersion: Long): SaveSnapshot
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
    /** 획득 성공(신규/동일 holder 갱신) 시 true, 다른 holder 가 점유 중이면 false */
    fun tryAcquire(gameId: Long, memberId: Long, holder: String, ttl: Duration): Boolean
}
