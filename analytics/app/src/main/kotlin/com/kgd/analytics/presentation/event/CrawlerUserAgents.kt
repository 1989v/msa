package com.kgd.analytics.presentation.event

/**
 * 크롤러 판별 (ADR-0095).
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
        "headlesschrome", "phantomjs", "lighthouse", "chrome-lighthouse",
        "bot/", "crawler", "spider",
    )

    fun isCrawler(userAgent: String?): Boolean {
        if (userAgent.isNullOrBlank()) return true          // UA 없음 — 브라우저는 항상 보낸다
        val ua = userAgent.lowercase()
        return markers.any { it in ua }
    }
}
