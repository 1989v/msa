package com.kgd.game.domain.profile.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.shouldBe

class GameNicknameTest : BehaviorSpec({
    given("global nickname normalization") {
        then("fullwidth, trim and case share the same key") {
            GameNickname.from("  Ａｌｉｃｅ  ").value shouldBe "Alice"
            GameNickname.from("ＡＬＩＣＥ").key shouldBe GameNickname.from("alice").key
            GameNickname.from("가나다 ._-").value shouldBe "가나다 ._-"
        }
        then("invalid characters and lengths are rejected") {
            listOf("a", "x".repeat(17), "hi!", "hello\nthere", "한😀", "  ").forEach {
                shouldThrow<IllegalArgumentException> { GameNickname.from(it) }
            }
        }
        then("length counts Unicode codepoints") {
            val letter = String(Character.toChars(0x10400))
            GameNickname.from(letter.repeat(16)).value shouldBe letter.repeat(16)
            shouldThrow<IllegalArgumentException> { GameNickname.from(letter.repeat(17)) }
        }
    }
})
