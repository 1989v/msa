package com.kgd.common.web

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class CrawlerUserAgentsTest : BehaviorSpec({

    Given("검색엔진 UA") {
        listOf(
            "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
            "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/W.X.Y.Z Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
            "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
            "Mozilla/5.0 (compatible; Yeti/1.1; +http://naver.me/spd)",
            // scripts/cdp-chrome.sh (--headless=new) 가 실제로 보내는 값 (2026-09-20 실측) — 검증용 헤드리스 크롬은 여기서 걸린다
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.0.0 Safari/537.36",
            // 실제 운영 로그에서 뽑은 것 — 노출 64,165건의 95% 가 이것이었다
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 (compatible; meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler))",
            "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)",
            // 목록에 없는 이름이고 bot·crawler·spider 어느 단어도 없다 — (compatible; 이름/버전) 모양만으로 잡혀야 한다.
            // 이 케이스가 없으면 위 둘은 URL 속 "crawler"·이름 속 "bot/" 로 우연히 잡혀, 모양 규칙이 죽어도 초록불이 난다.
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (compatible; Acme/1.0; +https://example.test/about)",
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

    Given("게이트웨이가 UA 없는 요청에 붙이는 기본값") {
        Then("크롤러로 본다 — 사람 브라우저는 UA 를 반드시 보내므로 이 값은 UA 없음의 서명이다") {
            CrawlerUserAgents.isCrawler("ReactorNetty/1.2.3") shouldBe true
        }
    }

    Given("UA 가 없을 때") {
        Then("크롤러로 본다 — 브라우저는 항상 UA 를 보낸다") {
            CrawlerUserAgents.isCrawler(null) shouldBe true
            CrawlerUserAgents.isCrawler("") shouldBe true
        }
    }
})
