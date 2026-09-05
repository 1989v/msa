package com.kgd.game.application.access.usecase

import com.kgd.game.application.access.dto.PrivateGameAccessDto

/**
 * 이 사람이 이 비밀 게임에 들어가도 되나.
 *
 * **관문(ingress `auth-url`)이 요청마다 부른다.** 게임 파일 한 덩이를 받을 때마다 도는
 * 자리라, 여기가 느리면 게임이 느려진다.
 */
interface CheckPrivateGameAccessUseCase {
    fun execute(gameSlug: String, memberId: Long): Boolean
}

/** 허용 명단을 보고 고친다 — 어드민 전용. */
interface ManagePrivateGameAccessUseCase {
    fun list(gameSlug: String): List<PrivateGameAccessDto>

    fun grant(gameSlug: String, memberId: Long, note: String?): PrivateGameAccessDto

    /** 없던 사람을 지우면 거짓 — 부르는 쪽이 404 로 답할 수 있게 한다. */
    fun revoke(gameSlug: String, memberId: Long): Boolean
}
