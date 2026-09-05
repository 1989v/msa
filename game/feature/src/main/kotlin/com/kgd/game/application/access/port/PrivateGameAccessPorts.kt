package com.kgd.game.application.access.port

import com.kgd.game.domain.access.model.PrivateGameAccess

interface PrivateGameAccessRepositoryPort {
    /** 관문이 요청마다 부른다 — 인덱스 하나로 끝나야 한다. */
    fun exists(gameSlug: String, memberId: Long): Boolean

    fun findAll(gameSlug: String): List<PrivateGameAccess>

    fun save(access: PrivateGameAccess): PrivateGameAccess

    fun delete(gameSlug: String, memberId: Long): Boolean
}
