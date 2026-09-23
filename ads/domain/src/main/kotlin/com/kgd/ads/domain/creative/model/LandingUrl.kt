package com.kgd.ads.domain.creative.model

import com.kgd.ads.domain.creative.exception.InvalidCreativeException

/** 유료 소재의 랜딩 URL — `https` 만, userinfo 금지, 2048자 이하. */
@JvmInline
value class LandingUrl private constructor(val value: String) {
    companion object {
        fun of(value: String): LandingUrl {
            LinkText.requirePlain(value)
            if (!LinkText.isSafeHttps(value)) throw InvalidCreativeException("랜딩 URL 은 userinfo 없는 https 여야 합니다")
            return LandingUrl(value)
        }
    }
}
