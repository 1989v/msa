package com.kgd.ads.domain.token.policy

import java.security.MessageDigest

/**
 * 방문자 id 의 해시 — 토큰·빈도 카운터·로그에는 방문자 id 대신 이 값만 둔다.
 * 결정과 이벤트가 같은 함수로 만들어야 토큰의 방문자 해시와 이벤트의 방문자가 맞는다.
 */
object VisitorHash {
    private const val HEX_LENGTH = 32

    fun of(visitorId: String): String =
        MessageDigest.getInstance("SHA-256").digest(visitorId.toByteArray())
            .joinToString("") { "%02x".format(it) }
            .take(HEX_LENGTH)
}
