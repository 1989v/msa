package com.kgd.common.security

import java.security.MessageDigest

/**
 * 토큰 저장소(Redis) 키 — **auth 와 gateway 가 같은 값을 만들어야 한다.**
 *
 * 접두사를 각자 적어 두었더니 auth 는 `auth:blacklist:`, gateway 는 `blacklist:` 를 봤고
 * 로그아웃이 실제로는 아무것도 무효화하지 못했다. 키 모양은 서비스 경계를 넘는 계약이라
 * 양쪽이 참조하는 한 곳에 둔다.
 *
 * 키에는 **토큰 원문이 아니라 SHA-256 해시**를 쓴다. 저장소가 통째로 새어도 그것만으로는
 * 로그인할 수 없어야 하기 때문이다(리프레시 토큰은 7일짜리 계정 접근권이다).
 * 값을 되찾을 일은 없고 정확히 일치하는지만 보므로 해시로 충분하다.
 */
object TokenKeys {
    fun refresh(token: String): String = "auth:refresh:${sha256(token)}"

    fun blacklist(token: String): String = "auth:blacklist:${sha256(token)}"

    private fun sha256(value: String): String =
        MessageDigest.getInstance("SHA-256")
            .digest(value.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
}
