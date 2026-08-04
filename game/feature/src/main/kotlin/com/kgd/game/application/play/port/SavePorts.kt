package com.kgd.game.application.play.port

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
