package com.kgd.common.crawler

/**
 * 스스로 밝히는 크롤러·링크 미리보기 봇 판별. 위장한 봇까지 잡으려면 행동 분석이 필요하고 범위 밖이다.
 *
 * 목록은 analytics 노출 원장의 판정에서 출발해 메신저 미리보기 봇을 더했다. 미리보기 봇은 공유된 주소를
 * 사람보다 먼저 연다 — 그대로 세면 「공유 1번 = 클릭 1번」이 된다.
 *
 * 카카오톡 인앱 브라우저(`KAKAOTALK x.y.z`)는 사람이다. 미리보기 봇만 `kakaotalk-scrap` 을 붙인다.
 */
object CrawlerUserAgents {
    /** UA 에 이 조각이 있으면 크롤러다. 대소문자 무시. */
    private val markers = listOf(
        "googlebot", "bingbot", "yeti", "duckduckbot", "applebot", "yandexbot",
        "baiduspider", "slurp", "facebookexternalhit", "twitterbot", "linkedinbot",
        "petalbot", "semrushbot", "ahrefsbot", "mj12bot", "dotbot",
        "meta-externalagent", "meta-webindexer", "facebookbot",
        "gptbot", "chatgpt-user", "oai-searchbot", "claudebot", "claude-web", "anthropic-ai",
        "ccbot", "bytespider", "amazonbot", "perplexitybot", "cohere-ai",
        "headlesschrome", "phantomjs", "lighthouse", "chrome-lighthouse",
        "bot/", "crawler", "spider",
        // 메신저 링크 미리보기
        "kakaotalk-scrap", "slackbot", "discordbot", "telegrambot", "whatsapp",
        // 게이트웨이(Reactor Netty)는 UA 없는 요청에 자기 이름을 붙여 넘긴다 — 이것이 「UA 없음」의 실제 모양이다.
        "reactornetty",
    )

    /** 브라우저 UA 뒤에 `(compatible; <이름>/…)` 를 붙이는 봇 관행. 사람 브라우저는 이 모양을 쓰지 않는다. */
    private val compatibleBot = Regex("""\(compatible;\s*[a-z][a-z0-9_-]*""", RegexOption.IGNORE_CASE)

    fun isCrawler(userAgent: String?): Boolean {
        if (userAgent.isNullOrBlank()) return true
        val ua = userAgent.lowercase()
        return markers.any { it in ua } || compatibleBot.containsMatchIn(ua)
    }
}
