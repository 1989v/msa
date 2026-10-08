package com.kgd.common.shortlink

import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * 단축 주소 설정. 단축 주소와 목적지의 호스트는 여기서만 얻는다 — 요청의 `Host`·`X-Forwarded-Host` 는
 * 위조할 수 있어 오픈 리다이렉트가 된다.
 *
 * - `origin` — 단축 주소 호스트(apex)
 * - `*-origin` — 접두사별 목적지 서비스
 * - `expose` — 상세·어드민 응답에 `shortUrl` 을 실을지. 해석 경로를 배포·실측한 뒤에 켠다
 */
@ConfigurationProperties(prefix = "kgd.common.short-link")
data class ShortLinkProperties(
    val origin: String = "https://1989v.com",
    val resumeOrigin: String = "https://resume.1989v.com",
    val placeOrigin: String = "https://place.1989v.com",
    val gameOrigin: String = "https://game.1989v.com",
    val blogOrigin: String = "https://blog.1989v.com",
    val expose: Boolean = false,
)
