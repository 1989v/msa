package com.kgd.common.shortlink

import io.kotest.assertions.withClue
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class ClickContextTest : BehaviorSpec({

    given("리퍼러") {
        then("호스트만 남기고 경로·쿼리는 버린다") {
            ClickContext.referrerHost("https://open.kakao.com/o/abc?member=42") shouldBe "open.kakao.com"
        }

        then("없거나 비었거나 URI 로 읽을 수 없으면 null") {
            listOf(null, "", "  ", "ht tp://broken host", "android-app://").forEach { referrer ->
                withClue("$referrer") { ClickContext.referrerHost(referrer) shouldBe null }
            }
        }

        then("호스트는 120자에서 자른다 — 원장 컬럼 폭") {
            val longHost = "a".repeat(60) + "." + "b".repeat(60) + ".com"
            ClickContext.referrerHost("https://$longHost/x") shouldBe longHost.take(120)
        }
    }

    given("UA") {
        then("Mobi 가 들어 있으면 mobile, 아니면 desktop") {
            mapOf(
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148" to "mobile",
                "Mozilla/5.0 (Linux; Android 14) Chrome/121.0.0.0 Mobile Safari/537.36" to "mobile",
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/129.0.0.0 Safari/537.36" to "desktop",
                null to "desktop",
            ).forEach { (ua, family) -> withClue("$ua") { ClickContext.uaFamily(ua) shouldBe family } }
        }
    }
})
