package com.kgd.common.shortlink

import org.springframework.web.util.UriUtils
import java.nio.charset.StandardCharsets.UTF_8

/**
 * 단축 주소·목적지 조립. 도메인은 접두사와 목적지 경로만 넘긴다. 302 응답은 [ShortLinkRedirects] 가 만든다.
 *
 * 요청 객체를 받지 않는다 — 호스트는 [ShortLinkProperties] 에서만 온다.
 */
class ShortLinks(properties: ShortLinkProperties) {

    private val origin = properties.origin.trimEnd('/')
    private val expose = properties.expose
    private val serviceOrigins = mapOf(
        ShortLinkPrefix.RESUME to properties.resumeOrigin,
        ShortLinkPrefix.PLACE to properties.placeOrigin,
        ShortLinkPrefix.GAME to properties.gameOrigin,
        ShortLinkPrefix.BLOG to properties.blogOrigin,
    ).mapValues { it.value.trimEnd('/') }

    fun shortUrl(prefix: ShortLinkPrefix, code: String): String = "$origin/${prefix.path}/$code"

    /** 응답에 실을 단축 주소. 노출이 꺼져 있으면 null. */
    fun exposedShortUrl(prefix: ShortLinkPrefix, code: String): String? =
        if (expose) shortUrl(prefix, code) else null

    /** 서비스 origin + 인코딩한 경로 세그먼트(+ 쿼리). 세그먼트가 없으면 서비스 루트(`/`)다. */
    fun destination(
        prefix: ShortLinkPrefix,
        vararg pathSegments: String,
        query: Map<String, String> = emptyMap(),
    ): String {
        val path = pathSegments.joinToString("/", prefix = "/") { UriUtils.encodePathSegment(it, UTF_8) }
        val queryString = query.entries.joinToString("&") { (k, v) ->
            "${UriUtils.encodeQueryParam(k, UTF_8)}=${encodeQueryValue(v)}"
        }
        val base = serviceOrigins.getValue(prefix) + path
        return if (queryString.isEmpty()) base else "$base?$queryString"
    }

    /** `/{접두사}/list` 와 해석 실패가 가는 곳 — 서비스 홈. */
    fun home(prefix: ShortLinkPrefix): String = destination(prefix)

    // encodeQueryParam 은 `+`·`/`·`=` 를 그대로 두는데, 수신 측이 `+` 를 공백으로 읽으므로 값은 모두 인코딩한다.
    private fun encodeQueryValue(value: String): String = UriUtils.encode(value, UTF_8)
}
