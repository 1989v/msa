package com.kgd.codedictionary.application.portfolio.service

import com.github.benmanes.caffeine.cache.Ticker
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.util.concurrent.TimeUnit

class SnippetUnlockServiceTest : BehaviorSpec({

    // Caffeine 만료는 시계를 주입해 검증한다 — 실제 1시간을 기다릴 수는 없다
    class FakeTicker : Ticker {
        var nanos = 0L
        override fun read(): Long = nanos
        fun advanceMinutes(minutes: Long) {
            nanos += TimeUnit.MINUTES.toNanos(minutes)
        }
    }

    given("광고 시청을 마쳤을 때") {
        val ticker = FakeTicker()
        val service = SnippetUnlockService(ticker)

        `when`("토큰을 발급하면") {
            val issued = service.issue()

            then("발급 직후에는 유효하다") {
                service.isValid(issued.token) shouldBe true
                issued.expiresIn shouldBe 3600L
            }

            then("TTL 이 지나면 무효다") {
                ticker.advanceMinutes(61)
                service.isValid(issued.token) shouldBe false
            }
        }
    }

    given("발급된 적 없는 토큰일 때") {
        val service = SnippetUnlockService(FakeTicker())

        `when`("검증하면") {
            then("무효다 — null·공백 포함") {
                service.isValid("no-such-token") shouldBe false
                service.isValid(null) shouldBe false
                service.isValid("  ") shouldBe false
            }
        }
    }
})
