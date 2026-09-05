package com.kgd.game.application.access.port

import com.kgd.game.domain.access.model.PrivateGameAccess

interface PrivateGameAccessRepositoryPort {
    /** 관문이 요청마다 부른다 — 인덱스 하나로 끝나야 한다. */
    fun exists(gameSlug: String, memberId: Long): Boolean

    fun findAll(gameSlug: String): List<PrivateGameAccess>

    fun save(access: PrivateGameAccess): PrivateGameAccess

    fun delete(gameSlug: String, memberId: Long): Boolean
}

/**
 * 들고 온 토큰이 **누구인가**.
 *
 * 토큰이 JWT 라는 것은 이 층이 알 일이 아니다 — 서명 방식이 바뀌어도 「누구인가」를 묻는
 * 코드는 그대로여야 하고, 컨트롤러가 검증기를 직접 들면 레이어 규칙(ADR-0083 ④)에도 걸린다.
 * 못 알아보면 null 이다.
 */
interface TokenIdentityPort {
    fun memberIdOf(token: String): Long?
}
