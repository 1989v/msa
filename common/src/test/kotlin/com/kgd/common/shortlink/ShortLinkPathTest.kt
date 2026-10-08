package com.kgd.common.shortlink

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class ShortLinkPathTest : BehaviorSpec({

    val cases = listOf(
        "" to ShortLinkPath.Home,
        "/" to ShortLinkPath.Home,
        "/list" to ShortLinkPath.Home,
        "/list/" to ShortLinkPath.Home,
        "/abc123" to ShortLinkPath.Code("abc123"),
        "/abc123/" to ShortLinkPath.Code("abc123"),
        // 형식은 보지 않는다 — 이력서 10자 코드도, 깨진 코드도 그대로 넘긴다
        "/Ab3dE6gH9k" to ShortLinkPath.Code("Ab3dE6gH9k"),
        "/a-b" to ShortLinkPath.Code("a-b"),
        "/LIST" to ShortLinkPath.Code("LIST"),
        "/abc123/x" to ShortLinkPath.Invalid,
        "/list/x" to ShortLinkPath.Invalid,
        "/abc123//" to ShortLinkPath.Invalid,
    )

    given("접두사 뒤 경로") {
        cases.forEach { (path, expected) ->
            `when`("「$path」 를 가르면") {
                then("$expected 다") { ShortLinkPath.parse(path) shouldBe expected }
            }
        }
    }
})
