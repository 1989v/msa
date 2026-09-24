package com.kgd.gateway.config

import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import org.springframework.web.server.ServerWebExchange

/**
 * 광고 공개 라우트가 받는 Host 목록 (`kgd.gateway.ads.allowed-hosts`, 쉼표 구분, overlay 마다 값).
 *
 * 우회 호스트 rt 는 Cloudflare 를 거치지 않아 리미터 키인 `CF-Connecting-IP` 를 위조할 수 있으므로
 * 목록에 넣지 않는다. 비교는 정확 일치라 `*.1989v.com` 같은 패턴은 아무 호스트와도 맞지 않는다.
 * 값이 비어 있으면 어떤 호스트도 받지 않는다 — 설정이 빠진 배포는 광고 공개 경로가 404 로 닫힌다.
 */
@Component
class AdsHostAllowlist(
    @Value("\${kgd.gateway.ads.allowed-hosts:}") raw: String,
) {
    val hosts: Set<String> = raw.split(',')
        .map { it.trim().lowercase() }
        .filter { it.isNotEmpty() }
        .toSet()

    fun allows(exchange: ServerWebExchange): Boolean {
        val host = exchange.request.headers.host?.hostString?.lowercase() ?: return false
        return host in hosts
    }
}
