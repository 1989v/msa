package com.kgd.game.infrastructure.security.adapter

import com.kgd.common.security.JwtUtil
import com.kgd.game.application.access.port.TokenIdentityPort
import org.springframework.stereotype.Component

/**
 * 도메인 쿠키에 담긴 토큰을 회원 번호로 바꾼다.
 *
 * **여기만 JWT 를 안다.** 서명 검증을 먼저 하고, 통과한 뒤에만 주체를 읽는다 —
 * 검증 없이 주체만 읽으면 아무나 자기 번호를 적어 넣을 수 있다.
 * 주체가 숫자가 아니면(게스트 등) 회원이 아니므로 null 이다.
 */
@Component
class JwtTokenIdentityAdapter(
    private val jwtUtil: JwtUtil,
) : TokenIdentityPort {

    override fun memberIdOf(token: String): Long? {
        if (!jwtUtil.isValid(token)) return null
        return jwtUtil.extractUserId(token)?.toLongOrNull()
    }
}
