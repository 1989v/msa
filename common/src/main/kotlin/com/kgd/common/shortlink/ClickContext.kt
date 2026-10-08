package com.kgd.common.shortlink

import java.net.URI

/**
 * 단축 주소 클릭 원장에 남길 요청 맥락. 원장은 리퍼러 호스트와 UA 계열만 갖는다 — IP 와 전체 URL 은 받지 않는다.
 *
 * 크롤러는 호출부가 [com.kgd.common.web.CrawlerUserAgents] 로 이미 걸렀다는 전제다.
 */
object ClickContext {

    private const val REFERRER_HOST_MAX = 120

    /** 리퍼러는 호스트만 남긴다 — 전체 URL 은 쿼리에 개인 식별자가 실려 올 때가 있다. */
    fun referrerHost(referrer: String?): String? =
        referrer?.takeIf { it.isNotBlank() }
            ?.let { runCatching { URI(it).host }.getOrNull() }
            ?.take(REFERRER_HOST_MAX)

    /** 사람의 기기 계열. */
    fun uaFamily(userAgent: String?): String =
        if (userAgent?.contains("Mobi", ignoreCase = true) == true) "mobile" else "desktop"
}
