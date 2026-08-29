package com.kgd.common.security

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.string.shouldNotContain
import io.kotest.matchers.string.shouldStartWith

class TokenKeysTest : BehaviorSpec({

    val token = "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiI3In0.signature-part"

    given("토큰으로 저장소 키를 만들면") {
        `when`("키를 들여다보면") {
            then("토큰 원문이 들어 있으면 안 된다") {
                // 저장소가 통째로 새어도 그것만으로는 로그인할 수 없어야 한다 —
                // 리프레시 토큰은 7일짜리 계정 접근권이다
                TokenKeys.refresh(token) shouldNotContain token
                TokenKeys.blacklist(token) shouldNotContain token
            }

            then("용도별 접두사가 붙어야 한다") {
                TokenKeys.refresh(token) shouldStartWith "auth:refresh:"
                TokenKeys.blacklist(token) shouldStartWith "auth:blacklist:"
            }
        }

        `when`("같은 토큰으로 다시 만들면") {
            then("같은 키가 나와야 한다 — 쓴 쪽과 읽는 쪽이 만나는 유일한 근거다") {
                TokenKeys.refresh(token) shouldBe TokenKeys.refresh(token)
            }
        }

        `when`("토큰이 다르면") {
            then("다른 키여야 한다") {
                TokenKeys.refresh(token) shouldNotBe TokenKeys.refresh("$token-2")
            }
        }

        `when`("용도가 다르면") {
            then("같은 토큰이라도 다른 키여야 한다 — 폐기 목록이 원장을 덮어쓰면 안 된다") {
                TokenKeys.refresh(token) shouldNotBe TokenKeys.blacklist(token)
            }
        }
    }
})
