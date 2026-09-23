package com.kgd.ads.domain.creative.model

import com.kgd.ads.domain.creative.exception.InvalidCreativeException
import java.net.URI
import java.net.URISyntaxException

internal object LinkText {
    const val MAX_LENGTH = 2048

    /** 공백·제어 문자는 브라우저가 지우거나 해석을 바꿔(`/\t/evil` → `//evil`) 검사를 우회시킨다. */
    fun requirePlain(value: String) {
        if (value.isEmpty() || value.length > MAX_LENGTH) throw InvalidCreativeException("링크는 1~${MAX_LENGTH}자여야 합니다")
        if (value.any { it.isWhitespace() || it.isISOControl() }) throw InvalidCreativeException("링크에 공백·제어 문자를 둘 수 없습니다")
    }

    /** https 이고 호스트가 있으며 userinfo(`user@`)가 없는 절대 URL. */
    fun isSafeHttps(value: String): Boolean {
        val uri = try {
            URI(value)
        } catch (e: URISyntaxException) {
            return false
        }
        return uri.scheme == "https" &&
            !uri.host.isNullOrEmpty() &&
            uri.rawUserInfo == null &&
            uri.rawAuthority?.contains('@') != true
    }
}
