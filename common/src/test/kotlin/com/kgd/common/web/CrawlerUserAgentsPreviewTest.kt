package com.kgd.common.web

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

/** 메신저 링크 미리보기 봇과 사람 브라우저(카카오톡 인앱 포함)를 실제 UA 문자열로 가른다. */
class CrawlerUserAgentsPreviewTest : BehaviorSpec({

    val crawlers = mapOf(
        "카카오톡 링크 미리보기" to
            "facebookexternalhit/1.1; kakaotalk-scrap/1.0; +https://devtalk.kakao.com/t/scrap/33984",
        "페이스북 미리보기" to
            "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
        "슬랙 미리보기" to "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
        "디스코드 미리보기" to "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
        "트위터 미리보기" to "Twitterbot/1.0",
        "텔레그램 미리보기" to "TelegramBot (like TwitterBot)",
        "왓츠앱 미리보기" to "WhatsApp/2.23.20.0 A",
        "헤드리스 크롬" to
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36",
        "구글봇" to
            "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "네이버 예티" to
            "Mozilla/5.0 (compatible; Yeti/1.1; +https://naver.me/spd)",
        "게이트웨이가 붙인 기본 UA" to "ReactorNetty/1.2.0",
        "UA 없음" to null,
        "빈 UA" to "  ",
    )

    val humans = mapOf(
        "맥 크롬" to
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
        "아이폰 사파리" to
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1",
        "카카오톡 인앱 브라우저" to
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.8.5",
        "안드로이드 삼성 인터넷" to
            "Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36",
        "윈도 파이어폭스" to
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0",
    )

    given("크롤러·미리보기 봇 UA") {
        crawlers.forEach { (case, ua) ->
            `when`(case) {
                then("크롤러다") { CrawlerUserAgents.isCrawler(ua) shouldBe true }
            }
        }
    }

    given("사람 브라우저 UA") {
        humans.forEach { (case, ua) ->
            `when`(case) {
                then("크롤러가 아니다") { CrawlerUserAgents.isCrawler(ua) shouldBe false }
            }
        }
    }
})
