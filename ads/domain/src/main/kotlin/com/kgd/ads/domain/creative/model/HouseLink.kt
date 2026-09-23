package com.kgd.ads.domain.creative.model

import com.kgd.ads.domain.creative.exception.InvalidCreativeException

/**
 * HOUSE 소재의 링크 — 앱 안 경로 또는 userinfo 없는 https URL.
 * 앱 안 경로는 `/` 다음이 `/`·`\` 가 아니어야 한다 — 브라우저는 `//host`·`/\host` 를 다른 호스트로 읽는다.
 */
@JvmInline
value class HouseLink private constructor(val value: String) {
    companion object {
        private val APP_PATH = Regex("""^/(?![/\\])""")

        fun of(value: String): HouseLink {
            LinkText.requirePlain(value)
            if (!APP_PATH.containsMatchIn(value) && !LinkText.isSafeHttps(value)) {
                throw InvalidCreativeException("HOUSE 링크는 앱 안 경로 또는 https 여야 합니다")
            }
            return HouseLink(value)
        }
    }
}
