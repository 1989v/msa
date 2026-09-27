package com.kgd.game.domain.profile.model

import java.text.Normalizer
import java.util.Locale

/** Canonical display and uniqueness rules shared by every game. */
class GameNickname private constructor(val value: String, val key: String) {
    companion object {
        fun from(raw: String): GameNickname {
            val value = Normalizer.normalize(raw, Normalizer.Form.NFKC).trim()
            require(value.codePointCount(0, value.length) in 2..16 &&
                Regex("^[\\p{L}\\p{N} ._-]+$").matches(value)) {
                "닉네임은 2~16자 (문자/숫자/공백/._-)"
            }
            return GameNickname(value, value.lowercase(Locale.ROOT))
        }
    }
}
