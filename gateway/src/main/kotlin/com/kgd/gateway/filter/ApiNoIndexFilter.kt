package com.kgd.gateway.filter

import org.springframework.cloud.gateway.filter.GatewayFilterChain
import org.springframework.cloud.gateway.filter.GlobalFilter
import org.springframework.core.Ordered
import org.springframework.stereotype.Component
import org.springframework.web.server.ServerWebExchange
import reactor.core.publisher.Mono

/**
 * `/api/` 응답은 색인하지 않는다 — 크롤은 막지 않고 색인만 막는다.
 *
 * robots 로 `/api/` 를 막으면 구글 렌더러가 화면의 데이터 호출을 못 해 서버 렌더 본문이 오류 문구로 바뀌고
 * 페이지 전체가 Soft 404 가 된다(2026-10-11). 그래서 크롤은 열고, JSON 이 검색 결과에 나오는 것은 이 헤더로 막는다.
 * 서버 렌더 페이지(`/posts/…`·`/attractions/…`)도 게이트웨이를 지나므로 경로를 `/api/` 로 한정한다.
 */
@Component
class ApiNoIndexFilter : GlobalFilter, Ordered {

    companion object {
        const val HEADER = "X-Robots-Tag"
        const val VALUE = "noindex"
        private const val API_PREFIX = "/api/"
    }

    override fun getOrder(): Int = -20

    override fun filter(exchange: ServerWebExchange, chain: GatewayFilterChain): Mono<Void> {
        if (exchange.request.path.value().startsWith(API_PREFIX)) {
            val response = exchange.response
            response.beforeCommit {
                response.headers.set(HEADER, VALUE)
                Mono.empty()
            }
        }
        return chain.filter(exchange)
    }
}
