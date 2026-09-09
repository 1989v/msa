package com.kgd.game.infrastructure.arcade

import com.kgd.game.domain.arcade.SessionId
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.string.shouldContain
import org.springframework.beans.factory.annotation.Value

/**
 * ADR-0092 — 세션 서명 키가 없으면 뜨지 않는다.
 *
 * **두 가지를 따로 잰다.** 컴포넌트의 검사만 재면 배선 회귀를 못 잡기 때문이다 —
 * 테스트가 생성자를 직접 부르면 `@Value` 의 기본값은 쓰이지 않아서, 공개 기본값을
 * 되살려도 그 검사는 초록불이 난다. 실제로 회귀를 주입해 그 사실을 확인했다.
 */
class HmacGateSpec : BehaviorSpec({

    given("컴포넌트의 키 검사") {
        `when`("키가 비어 있으면") {
            then("빈이 만들어지지 않는다") {
                val e = shouldThrow<IllegalStateException> { HmacSessionTokenService("") }
                e.message shouldContain "GAME_HMAC_SECRET"
            }
        }
        `when`("키가 32바이트 미만이면") {
            then("빈이 만들어지지 않는다") {
                shouldThrow<IllegalStateException> { HmacSessionTokenService("short-key") }
            }
        }
        `when`("키가 32바이트 이상이면") {
            then("서명이 만들어진다") {
                HmacSessionTokenService("a".repeat(32))
                    .issue(SessionId("s1"), 7, 1L) shouldNotBe ""
            }
        }
    }

    given("주입 배선") {
        `when`("생성자의 @Value 기본값을 보면") {
            then("빈 문자열이다 — 폴백할 키가 없다") {
                val param = HmacSessionTokenService::class.java.constructors
                    .single { it.parameterCount == 1 }
                    .parameters.single()
                val fallback = param.getAnnotation(Value::class.java)!!.value
                    .substringAfter("hmac-secret:").substringBefore("}")

                // 여기 값이 생기면 키 없이 뜨는 경로가 되살아난다. 그 값으로 서명하면
                // 공개 레포에 적힌 문자열로 서명하는 것이라 위조를 못 막는다.
                shouldThrow<IllegalStateException> { HmacSessionTokenService(fallback) }
            }
        }
    }
})
