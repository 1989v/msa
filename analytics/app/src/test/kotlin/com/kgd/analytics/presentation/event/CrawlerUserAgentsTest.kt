package com.kgd.analytics.presentation.event

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class CrawlerUserAgentsTest : BehaviorSpec({

    Given("검색엔진 UA") {
        listOf(
            "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
            "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/W.X.Y.Z Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
            "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
            "Mozilla/5.0 (compatible; Yeti/1.1; +http://naver.me/spd)",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0 Safari/537.36",
        ).forEach { ua ->
            When("「${ua.take(40)}…」") {
                Then("크롤러로 본다") { CrawlerUserAgents.isCrawler(ua) shouldBe true }
            }
        }
    }

    Given("사람 브라우저 UA") {
        listOf(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
            "Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
        ).forEach { ua ->
            When("「${ua.take(40)}…」") {
                Then("사람으로 본다 — 사람을 거르면 원장이 빈다") { CrawlerUserAgents.isCrawler(ua) shouldBe false }
            }
        }
    }

    Given("UA 가 없을 때") {
        Then("크롤러로 본다 — 브라우저는 항상 UA 를 보낸다") {
            CrawlerUserAgents.isCrawler(null) shouldBe true
            CrawlerUserAgents.isCrawler("") shouldBe true
        }
    }
})
