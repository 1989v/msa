package com.kgd.common.web

/**
 * 크롤러 판별 (ADR-0095).
 *
 * analytics(노출·클릭 원장)와 game(랭킹 제출)이 같은 목록을 쓴다. 마커는 운영 관찰로 자라는 것이라
 * 두 곳이 따로 들면 한쪽만 갱신되어 「원장은 거르는데 랭킹은 받는」 상태가 된다.
 *
 * **원장에 넣기 전에 거른다.** 관광지 상세 6만 URL 이 사이트맵에 있어 검색엔진이 JS 를
 * 렌더하며 IntersectionObserver 를 전부 켠다. 배포 사흘 만에 노출 64,165건이 쌓였는데
 * 방문자 6,287명 전원이 「화면 하나 · 카드 전부 · 클릭 0 · 재방문 0」 이었고 새벽 4~5시에
 * 봉우리가 섰다 (2026-09-17 실측). 사람이 아니다.
 *
 * 들어간 뒤 거르면 인기 집계가 「구글봇이 크롤한 순서」가 되고, 그걸로 링크 수집 예산을 쓴다.
 *
 * 스스로 밝히는 크롤러만 거른다 — 위장한 봇까지 잡으려면 행동 분석이 필요하고 그건 다른 문제다.
 */
object CrawlerUserAgents {
    /** UA 에 이 조각이 있으면 크롤러다. 대소문자 무시. */
    private val markers = listOf(
        "googlebot", "bingbot", "yeti", "duckduckbot", "applebot", "yandexbot",
        "baiduspider", "slurp", "facebookexternalhit", "twitterbot", "linkedinbot",
        "petalbot", "semrushbot", "ahrefsbot", "mj12bot", "dotbot",
        // AI 크롤러 — 관광지 상세 노출의 95% 가 meta-externalagent 였다 (2026-09-17 ingress 로그)
        "meta-externalagent", "meta-webindexer", "facebookbot",
        "gptbot", "chatgpt-user", "oai-searchbot", "claudebot", "claude-web", "anthropic-ai",
        "ccbot", "bytespider", "amazonbot", "perplexitybot", "cohere-ai",
        "headlesschrome", "phantomjs", "lighthouse", "chrome-lighthouse",
        "bot/", "crawler", "spider",
        // 「UA 없음」의 실제 모양. 이 서비스는 게이트웨이(Spring Cloud Gateway) 뒤에 있고,
        // Reactor Netty 는 들어온 요청에 UA 가 없으면 자기 이름을 기본값으로 붙여 넘긴다.
        // 그래서 아래 isNullOrBlank 분기는 여기서는 사실상 닿지 않고, 이 마커가 그 자리를 맡는다.
        // 운영에서 확인: ingress 는 `-` 로 받았는데 서버는 크롤러로 안 봤다 (2026-09-17).
        "reactornetty",
    )

    /**
     * 브라우저 UA 뒤에 `(compatible; <이름>/<버전> …)` 를 붙이는 관행. 메타·구글이 이 형태다.
     * 이름을 몰라도 이 모양이면 크롤러로 본다 — 목록에 없는 새 봇을 그때그때 쫓지 않기 위해서다.
     * 사람 브라우저는 `compatible;` 을 쓰지 않는다 (옛 IE 는 `compatible; MSIE` 였고 이제 없다).
     */
    private val compatibleBot = Regex("""\(compatible;\s*[a-z][a-z0-9_-]*""", RegexOption.IGNORE_CASE)

    fun isCrawler(userAgent: String?): Boolean {
        if (userAgent.isNullOrBlank()) return true          // UA 없음 — 브라우저는 항상 보낸다
        val ua = userAgent.lowercase()
        return markers.any { it in ua } || compatibleBot.containsMatchIn(ua)
    }
}
