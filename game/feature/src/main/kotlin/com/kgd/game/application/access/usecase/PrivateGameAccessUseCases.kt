package com.kgd.game.application.access.usecase

import com.kgd.game.application.access.dto.PrivateGameAccessDto

/**
 * 이 토큰을 들고 이 비밀 게임에 들어가도 되나.
 *
 * **관문(ingress `auth-url`)이 요청마다 부른다.** 게임 파일 한 덩이를 받을 때마다 도는
 * 자리라, 여기가 느리면 게임이 느려진다.
 *
 * 판정을 **네 갈래로 돌려준다** — 부르는 쪽이 상태 코드를 고를 수 있어야 한다.
 * 「로그인해라(401)」와 「너는 안 된다(403)」는 사용자에게 전혀 다른 말이고,
 * 참·거짓 하나로 합치면 로그인 화면으로 보낼지 그냥 막을지를 정할 수 없다.
 */
interface CheckPrivateGameAccessUseCase {
    fun execute(gameSlug: String, token: String?): Verdict

    enum class Verdict {
        /** 토큰이 아예 없다 — 로그인부터 */
        NO_TOKEN,

        /** 우리가 발급한 토큰이 아니거나 회원 번호를 못 읽는다 */
        BAD_TOKEN,

        /** 로그인은 했으나 허용 명단에 없다 */
        DENIED,

        ALLOWED,
    }
}

/** 허용 명단을 보고 고친다 — 어드민 전용. */
interface ManagePrivateGameAccessUseCase {
    fun list(gameSlug: String): List<PrivateGameAccessDto>

    fun grant(gameSlug: String, memberId: Long, note: String?): PrivateGameAccessDto

    /** 없던 사람을 지우면 거짓 — 부르는 쪽이 404 로 답할 수 있게 한다. */
    fun revoke(gameSlug: String, memberId: Long): Boolean
}
